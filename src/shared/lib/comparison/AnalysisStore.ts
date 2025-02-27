import { remoteData } from 'cbioportal-frontend-commons';
import {
    CancerStudy,
    Gene,
    Mutation,
    MutationCountByPosition,
    Sample,
} from 'cbioportal-ts-api-client';
import { computed, makeObservable, observable } from 'mobx';
import _ from 'lodash';
import internalClient from '../../api/cbioportalInternalClientInstance';
import {
    evaluatePutativeDriverInfo,
    evaluatePutativeDriverInfoWithHotspots,
    fetchOncoKbCancerGenes,
    fetchOncoKbDataForOncoprint,
    filterAndAnnotateMutations,
    getGenomeNexusUrl,
    makeGetOncoKbMutationAnnotationForOncoprint,
    makeIsHotspotForOncoprint,
    ONCOKB_DEFAULT,
} from 'shared/lib/StoreUtils';
import MobxPromise, { MobxPromiseUnionTypeWithDefault } from 'mobxpromise';
import { DriverAnnotationSettings } from 'shared/alterationFiltering/AnnotationFilteringSettings';
import { getServerConfig } from 'config/config';
import { CoverageInformation } from '../GenePanelUtils';
import { CancerGene, IndicatorQueryResp } from 'oncokb-ts-api-client';
import {
    getProteinPositionFromProteinChange,
    IHotspotIndex,
    indexHotspotsData,
    IOncoKbData,
} from 'cbioportal-utils';
import { fetchHotspotsData } from '../CancerHotspotsUtils';
import {
    GenomeNexusAPI,
    GenomeNexusAPIInternal,
} from 'genome-nexus-ts-api-client';
import {
    countMutations,
    mutationCountByPositionKey,
} from 'pages/resultsView/mutationCountHelpers';
import ComplexKeyCounter from '../complexKeyDataStructures/ComplexKeyCounter';
import GeneCache from 'shared/cache/GeneCache';
import eventBus from 'shared/events/eventBus';
import { SiteError } from 'shared/model/appMisc';
import { ErrorMessages } from 'shared/errorMessages';

export default abstract class AnalysisStore {
    @observable driverAnnotationSettings: DriverAnnotationSettings;
    constructor() {}

    abstract mutations: MobxPromise<Mutation[]>;
    abstract get includeGermlineMutations(): boolean;
    abstract get studies(): MobxPromiseUnionTypeWithDefault<CancerStudy[]>;
    abstract genes: MobxPromise<Gene[]>;

    // everything below taken from the results view page store in order to get the annotated mutations
    readonly oncoKbCancerGenes = remoteData(
        {
            invoke: () => {
                if (getServerConfig().show_oncokb) {
                    return fetchOncoKbCancerGenes();
                } else {
                    return Promise.resolve([]);
                }
            },
            onError: () => {},
        },
        []
    );

    readonly oncoKbAnnotatedGenes = remoteData(
        {
            await: () => [this.oncoKbCancerGenes],
            invoke: () => {
                if (
                    getServerConfig().show_oncokb &&
                    !_.isError(this.oncoKbCancerGenes.result)
                ) {
                    return Promise.resolve(
                        _.reduce(
                            this.oncoKbCancerGenes.result,
                            (
                                map: { [entrezGeneId: number]: boolean },
                                next: CancerGene
                            ) => {
                                if (next?.oncokbAnnotated) {
                                    map[next.entrezGeneId] = true;
                                }
                                return map;
                            },
                            {}
                        )
                    );
                } else {
                    return Promise.resolve({});
                }
            },
            onError: e => {},
        },
        {}
    );

    @computed get referenceGenomeBuild() {
        if (!this.studies.isComplete) {
            throw new Error('Failed to get studies');
        }
        return getGenomeNexusUrl(this.studies.result);
    }

    @computed get genomeNexusClient() {
        const client = new GenomeNexusAPI(this.referenceGenomeBuild);

        client.addErrorHandler(err => {
            eventBus.emit(
                'error',
                null,
                new SiteError(
                    new Error(ErrorMessages.GENOME_NEXUS_LOAD_ERROR),
                    'alert'
                )
            );
        });

        return client;
    }

    @computed get genomeNexusInternalClient() {
        const client = new GenomeNexusAPIInternal(this.referenceGenomeBuild);

        client.addErrorHandler(err => {
            eventBus.emit(
                'error',
                null,
                new SiteError(
                    new Error(ErrorMessages.GENOME_NEXUS_LOAD_ERROR),
                    'alert'
                )
            );
        });

        return client;
    }

    readonly entrezGeneIdToGene = remoteData<{ [entrezGeneId: number]: Gene }>({
        await: () => [this.genes],
        invoke: () =>
            Promise.resolve(
                _.keyBy(this.genes.result!, gene => gene.entrezGeneId)
            ),
    });

    readonly _filteredAndAnnotatedMutationsReport = remoteData({
        await: () => [
            this.mutations,
            this.getMutationPutativeDriverInfo,
            this.entrezGeneIdToGene,
        ],
        invoke: () => {
            return Promise.resolve(
                filterAndAnnotateMutations(
                    this.mutations.result!,
                    this.getMutationPutativeDriverInfo.result!,
                    this.entrezGeneIdToGene.result!
                )
            );
        },
    });

    readonly getMutationPutativeDriverInfo = remoteData({
        await: () => {
            const toAwait = [];
            if (this.driverAnnotationSettings.oncoKb) {
                toAwait.push(this.oncoKbMutationAnnotationForOncoprint);
            }
            if (this.driverAnnotationSettings.hotspots) {
                toAwait.push(this.isHotspotForOncoprint);
            }
            return toAwait;
        },
        invoke: () => {
            return Promise.resolve((mutation: Mutation): {
                oncoKb: string;
                hotspots: boolean;
                customDriverBinary: boolean;
                customDriverTier?: string;
            } => {
                const getOncoKbMutationAnnotationForOncoprint = this
                    .oncoKbMutationAnnotationForOncoprint.result!;
                const oncoKbDatum:
                    | IndicatorQueryResp
                    | undefined
                    | null
                    | false =
                    this.driverAnnotationSettings.oncoKb &&
                    getOncoKbMutationAnnotationForOncoprint &&
                    !(
                        getOncoKbMutationAnnotationForOncoprint instanceof Error
                    ) &&
                    getOncoKbMutationAnnotationForOncoprint(mutation);

                const isHotspotDriver =
                    this.driverAnnotationSettings.hotspots &&
                    !(this.isHotspotForOncoprint.result instanceof Error) &&
                    this.isHotspotForOncoprint.result!(mutation);

                // Note: custom driver annotations are part of the incoming datum
                return evaluatePutativeDriverInfoWithHotspots(
                    mutation,
                    oncoKbDatum,
                    this.driverAnnotationSettings.customBinary,
                    this.driverAnnotationSettings.driverTiers,
                    {
                        hotspotDriver: isHotspotDriver,
                        hotspotAnnotationsActive: this.driverAnnotationSettings
                            .hotspots,
                    }
                );
            });
        },
        onError: () => {},
    });

    // Hotspots
    readonly hotspotData = remoteData({
        await: () => [this.mutations],
        invoke: () => {
            return fetchHotspotsData(
                this.mutations,
                undefined,
                this.genomeNexusInternalClient
            );
        },
        onError: () => {},
    });

    readonly indexedHotspotData = remoteData<IHotspotIndex | undefined>({
        await: () => [this.hotspotData],
        invoke: () => Promise.resolve(indexHotspotsData(this.hotspotData)),
        onError: () => {},
    });

    public readonly isHotspotForOncoprint = remoteData<
        ((m: Mutation) => boolean) | Error
    >({
        invoke: () => makeIsHotspotForOncoprint(this.indexedHotspotData),
        onError: () => {},
    });

    //we need seperate oncokb data because oncoprint requires onkb queries across cancertype
    //mutations tab the opposite
    readonly oncoKbDataForOncoprint = remoteData<IOncoKbData | Error>(
        {
            await: () => [this.mutations, this.oncoKbAnnotatedGenes],
            invoke: async () => {
                return fetchOncoKbDataForOncoprint(
                    this.oncoKbAnnotatedGenes,
                    this.mutations
                );
            },
            onError: (err: Error) => {
                // fail silently, leave the error handling responsibility to the data consumer
            },
        },
        ONCOKB_DEFAULT
    );

    readonly oncoKbMutationAnnotationForOncoprint = remoteData<
        Error | ((mutation: Mutation) => IndicatorQueryResp | undefined)
    >({
        await: () => [this.oncoKbDataForOncoprint],
        invoke: () =>
            makeGetOncoKbMutationAnnotationForOncoprint(
                this.oncoKbDataForOncoprint
            ),
        onError: () => {},
    });

    readonly cbioportalMutationCountData = remoteData<{
        [mutationCountByPositionKey: string]: number;
    }>({
        await: () => [this.mutations],
        invoke: async () => {
            const mutationPositionIdentifiers = _.values(
                countMutations(this.mutations.result!)
            );

            if (mutationPositionIdentifiers.length > 0) {
                const data = await internalClient.fetchMutationCountsByPositionUsingPOST(
                    {
                        mutationPositionIdentifiers,
                    }
                );
                return _.mapValues(
                    _.groupBy(data, mutationCountByPositionKey),
                    (counts: MutationCountByPosition[]) =>
                        _.sumBy(counts, c => c.count)
                );
            } else {
                return {};
            }
        },
    });

    readonly geneCache = new GeneCache();
}
