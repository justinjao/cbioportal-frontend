import * as React from 'react';
import {
    AlterationEnrichment,
    GenericAssayEnrichment,
    GenomicEnrichment,
    MolecularProfile,
} from 'cbioportal-ts-api-client';
import { AlterationEnrichmentRow } from 'shared/model/AlterationEnrichmentRow';
import {
    ExpressionEnrichmentRow,
    GenericAssayEnrichmentRow,
} from 'shared/model/EnrichmentRow';
import { formatLogOddsRatio, roundLogRatio } from 'shared/lib/FormatUtils';
import _ from 'lodash';
import { AlterationTypeConstants, DataTypeConstants } from 'shared/constants';
import { filterAndSortProfiles } from '../coExpression/CoExpressionTabUtils';
import { IMiniFrequencyScatterChartData } from './MiniFrequencyScatterChart';
import {
    AlterationEnrichmentTableColumn,
    AlterationEnrichmentTableColumnType,
} from './AlterationEnrichmentsTable';
import styles from './styles.module.scss';
import classNames from 'classnames';
import { IMultipleCategoryBarPlotData } from 'pages/groupComparison/MultipleCategoryBarPlot';
import { getTextColor } from '../../groupComparison/OverlapUtils';
import { DefaultTooltip, TruncatedText } from 'cbioportal-frontend-commons';
import {
    ExpressionEnrichmentTableColumn,
    ExpressionEnrichmentTableColumnType,
} from './ExpressionEnrichmentsTable';
import { Datalabel } from 'shared/lib/DataUtils';
import {
    GenericAssayEnrichmentTableColumn,
    GenericAssayEnrichmentTableColumnType,
} from './GenericAssayEnrichmentsTable';

export type AlterationEnrichmentWithQ = AlterationEnrichment & {
    logRatio?: number;
    qValue: number;
    value?: number /* used for copy number in group comparison */;
};
export type ExpressionEnrichmentWithQ = GenomicEnrichment & {
    qValue: number;
};

export type GenericAssayEnrichmentWithQ = GenericAssayEnrichment & {
    qValue: number;
};

export type ContinousDataPvalueTooltipProps = {
    groupSize?: number;
};

export const CNA_AMP_VALUE = 2;
export const CNA_HOMDEL_VALUE = -2;
export const CNA_TO_ALTERATION: { [cna: number]: string } = {
    [CNA_AMP_VALUE]: 'AMP',
    [CNA_HOMDEL_VALUE]: 'HOMDEL',
};
export const PVALUE_TEST_GROUP_SIZE_THRESHOLD = 3;

export enum GeneOptionLabel {
    USER_DEFINED_OPTION = 'User-defined genes',
    HIGHEST_FREQUENCY = 'Genes with highest frequency in any group',
    AVERAGE_FREQUENCY = 'Genes with highest average frequency',
    SIGNIFICANT_P_VALUE = 'Genes with most significant p-value',
    SYNC_WITH_TABLE = 'Sync with table (up to 100 genes)',
}

export enum AlterationContainerType {
    MUTATION = 'MUTATION',
    COPY_NUMBER = 'COPY_NUMBER',
    ALTERATIONS = 'ALTERATIONS',
}

export enum EnrichmentType {
    MRNA_EXPRESSION = 'mRNA expression',
    PROTEIN_EXPRESSION = 'protein expression',
    DNA_METHYLATION = 'DNA methylation',
}

export function PERCENTAGE_IN_headerRender(name: string) {
    return (
        <div style={{ display: 'flex', alignItems: 'center' }}>
            <TruncatedText text={name} maxLength={20} addTooltip={'never'} />
        </div>
    );
}

export function STAT_IN_headerRender(stat: string, name: string) {
    return (
        <div style={{ display: 'flex', alignItems: 'center' }}>
            {stat}&nbsp;in&nbsp;
            <TruncatedText text={name} maxLength={20} addTooltip={'never'} />
        </div>
    );
}

export function calculateExpressionTendency(logOddsRatio: number): string {
    return logOddsRatio > 0 ? 'Over-expressed' : 'Under-expressed';
}

export function formatAlterationTendency(text: string) {
    return <TruncatedText text={text} maxLength={20} />;
}

export function formatPercentage(
    group: string,
    data: AlterationEnrichmentRow
): string {
    const datum = data.groupsSet[group];
    return (
        datum.alteredCount + ' (' + datum.alteredPercentage.toFixed(2) + '%)'
    );
}

export function getProfiledCount(
    group: string,
    data: AlterationEnrichmentRow
): number {
    return data.groupsSet[group].profiledCount;
}

export function getAlteredCount(
    group: string,
    data: AlterationEnrichmentRow
): number {
    return data.groupsSet[group].alteredCount;
}

function volcanoPlotYCoord(pValue: number) {
    if (pValue === 0 || Math.log10(pValue) < -10) {
        return 10;
    } else {
        return -Math.log10(pValue);
    }
}

export function getAlterationScatterData(
    alterationEnrichments: AlterationEnrichmentRow[],
    queryGenes: string[]
): any[] {
    return alterationEnrichments
        .filter(
            a =>
                a.pValue !== undefined &&
                a.qValue !== undefined &&
                !queryGenes.includes(a.hugoGeneSymbol)
        )
        .map(alterationEnrichment => {
            return {
                x: roundLogRatio(Number(alterationEnrichment.logRatio), 10),
                y: volcanoPlotYCoord(alterationEnrichment.pValue!),
                hugoGeneSymbol: alterationEnrichment.hugoGeneSymbol,
                pValue: alterationEnrichment.pValue,
                qValue: alterationEnrichment.qValue,
                logRatio: alterationEnrichment.logRatio,
                hovered: false,
            };
        });
}

export function getAlterationFrequencyScatterData(
    alterationEnrichments: AlterationEnrichmentRow[],
    queryGenes: string[],
    group1: string,
    group2: string
): IMiniFrequencyScatterChartData[] {
    return alterationEnrichments
        .filter(
            a =>
                a.pValue !== undefined &&
                a.qValue !== undefined &&
                !queryGenes.includes(a.hugoGeneSymbol)
        )
        .map(alterationEnrichment => {
            return {
                x: alterationEnrichment.groupsSet[group1].alteredPercentage,
                y: alterationEnrichment.groupsSet[group2].alteredPercentage,
                hugoGeneSymbol: alterationEnrichment.hugoGeneSymbol,
                pValue: alterationEnrichment.pValue!,
                qValue: alterationEnrichment.qValue!,
                logRatio: alterationEnrichment.logRatio!,
            };
        });
}

export function getExpressionScatterData(
    expressionEnrichments: ExpressionEnrichmentRow[],
    queryGenes: string[]
): any[] {
    return expressionEnrichments
        .filter(a => !queryGenes.includes(a.hugoGeneSymbol))
        .map(expressionEnrichment => {
            return {
                x: expressionEnrichment.logRatio,
                y: volcanoPlotYCoord(expressionEnrichment.pValue),
                hugoGeneSymbol: expressionEnrichment.hugoGeneSymbol,
                entrezGeneId: expressionEnrichment.entrezGeneId,
                pValue: expressionEnrichment.pValue,
                qValue: expressionEnrichment.qValue,
                logRatio: expressionEnrichment.logRatio,
                hovered: false,
            };
        });
}

export function getGenericAssayScatterData(
    genericAssayEnrichments: GenericAssayEnrichmentRow[]
): any[] {
    return genericAssayEnrichments.map(genericAssayEnrichment => {
        return {
            x: genericAssayEnrichment.logRatio,
            y: volcanoPlotYCoord(genericAssayEnrichment.pValue),
            stableId: genericAssayEnrichment.stableId,
            entityName: genericAssayEnrichment.entityName,
            pValue: genericAssayEnrichment.pValue,
            qValue: genericAssayEnrichment.qValue,
            logRatio: genericAssayEnrichment.logRatio,
            hovered: false,
        };
    });
}

export function getAlterationRowData(
    alterationEnrichments: AlterationEnrichmentWithQ[],
    queryGenes: string[],
    groups: { name: string; nameOfEnrichmentDirection?: string }[]
): AlterationEnrichmentRow[] {
    return alterationEnrichments.map(alterationEnrichment => {
        let countsWithAlteredPercentage = _.map(
            alterationEnrichment.counts,
            datum => {
                const alteredPercentage =
                    datum.alteredCount > 0 && datum.profiledCount > 0
                        ? (datum.alteredCount / datum.profiledCount) * 100
                        : 0;
                return {
                    ...datum,
                    alteredPercentage,
                };
            }
        );
        let groupsSet = _.keyBy(
            countsWithAlteredPercentage,
            count => count.name
        );
        let enrichedGroup: string | undefined = undefined;
        let logRatio: number | undefined = undefined;
        if (groups.length === 2) {
            let group1Data = groupsSet[groups[0].name];
            let group2Data = groupsSet[groups[1].name];
            if (alterationEnrichment.pValue !== undefined) {
                logRatio = Math.log2(
                    group1Data.alteredPercentage / group2Data.alteredPercentage
                );
                let group1Name =
                    groups[0].nameOfEnrichmentDirection || groups[0].name;
                let group2Name =
                    groups[1].nameOfEnrichmentDirection || groups[1].name;
                enrichedGroup = logRatio > 0 ? group1Name : group2Name;
            }
        } else if (alterationEnrichment.pValue !== undefined) {
            countsWithAlteredPercentage.sort(
                (a, b) => b.alteredPercentage - a.alteredPercentage
            );
            enrichedGroup = countsWithAlteredPercentage[0].name;
        }

        return {
            checked: queryGenes.includes(alterationEnrichment.hugoGeneSymbol),
            disabled: queryGenes.includes(alterationEnrichment.hugoGeneSymbol),
            hugoGeneSymbol: alterationEnrichment.hugoGeneSymbol,
            entrezGeneId: alterationEnrichment.entrezGeneId,
            cytoband: alterationEnrichment.cytoband,
            pValue: alterationEnrichment.pValue,
            qValue: alterationEnrichment.qValue,
            enrichedGroup,
            groupsSet,
            logRatio,
            value: alterationEnrichment.value,
        };
    });
}

export function getExpressionRowData(
    expressionEnrichments: ExpressionEnrichmentWithQ[],
    queryGenes: string[],
    groups: { name: string; nameOfEnrichmentDirection?: string }[]
): ExpressionEnrichmentRow[] {
    return expressionEnrichments.map(expressionEnrichment => {
        let enrichedGroup = '';
        let logRatio: number | undefined = undefined;
        let groupsSet = _.keyBy(
            expressionEnrichment.groupsStatistics,
            group => group.name
        );
        if (groups.length === 2) {
            let group1Data = groupsSet[groups[0].name];
            let group2Data = groupsSet[groups[1].name];
            logRatio = group1Data.meanExpression - group2Data.meanExpression;
            let group1Name =
                groups[0].nameOfEnrichmentDirection || groups[0].name;
            let group2Name =
                groups[1].nameOfEnrichmentDirection || groups[1].name;
            enrichedGroup = logRatio > 0 ? group1Name : group2Name;
        } else {
            enrichedGroup = expressionEnrichment.groupsStatistics.sort(
                (a, b) => b.meanExpression - a.meanExpression
            )[0].name;
        }

        return {
            checked: queryGenes.includes(expressionEnrichment.hugoGeneSymbol),
            disabled: queryGenes.includes(expressionEnrichment.hugoGeneSymbol),
            hugoGeneSymbol: expressionEnrichment.hugoGeneSymbol,
            entrezGeneId: expressionEnrichment.entrezGeneId,
            cytoband: expressionEnrichment.cytoband,
            pValue: expressionEnrichment.pValue,
            qValue: expressionEnrichment.qValue,
            enrichedGroup,
            groupsSet,
            logRatio,
        };
    });
}

export function getGenericAssayEnrichmentRowData(
    genericAssayEnrichments: GenericAssayEnrichmentWithQ[],
    groups: { name: string; nameOfEnrichmentDirection?: string }[]
): GenericAssayEnrichmentRow[] {
    return genericAssayEnrichments.map(genericAssayEnrichment => {
        let enrichedGroup = '';
        // fallback to stable id if name is not specified
        let entityName =
            'NAME' in genericAssayEnrichment.genericEntityMetaProperties
                ? genericAssayEnrichment.genericEntityMetaProperties['NAME']
                : genericAssayEnrichment.stableId;
        let logRatio: number | undefined = undefined;
        let groupsSet = _.keyBy(
            genericAssayEnrichment.groupsStatistics,
            group => group.name
        );
        if (groups.length === 2) {
            let group1Data = groupsSet[groups[0].name];
            let group2Data = groupsSet[groups[1].name];
            logRatio = group1Data.meanExpression - group2Data.meanExpression;
            let group1Name =
                groups[0].nameOfEnrichmentDirection || groups[0].name;
            let group2Name =
                groups[1].nameOfEnrichmentDirection || groups[1].name;
            enrichedGroup = logRatio > 0 ? group1Name : group2Name;
        } else {
            enrichedGroup = genericAssayEnrichment.groupsStatistics.sort(
                (a, b) => b.meanExpression - a.meanExpression
            )[0].name;
        }

        return {
            checked: false,
            disabled: false,
            stableId: genericAssayEnrichment.stableId,
            entityName,
            pValue: genericAssayEnrichment.pValue,
            qValue: genericAssayEnrichment.qValue,
            enrichedGroup,
            groupsSet,
            logRatio,
        };
    });
}

export function getFilteredData(
    data: (
        | ExpressionEnrichmentRow
        | AlterationEnrichmentRow
        | GenericAssayEnrichmentRow
    )[],
    expressedGroups: string[],
    qValueFilter: boolean,
    filterFunction: (value: string) => boolean,
    isGenericAssayData: boolean = false
): any[] {
    return data.filter(enrichmentDatum => {
        let result = false;
        expressedGroups.forEach(enrichedGroup => {
            const enrichedGroupData = enrichmentDatum.groupsSet[
                enrichedGroup
            ] as any;
            if (!enrichedGroupData) {
                return false;
            }
            let enrichedGroupAlteredPercentage =
                enrichedGroupData.meanExpression ||
                enrichedGroupData.alteredPercentage;
            let res = _.reduce(
                enrichmentDatum.groupsSet,
                (acc, next, group) => {
                    if (enrichedGroup !== group) {
                        let alteredPercentage =
                            (next as any).meanExpression ||
                            (next as any).alteredPercentage;
                        acc =
                            acc &&
                            enrichedGroupAlteredPercentage >= alteredPercentage;
                    }
                    return acc;
                },
                true
            );
            if (res) {
                result = res;
                return false;
            }
        });
        if (qValueFilter && enrichmentDatum.qValue) {
            result = result && enrichmentDatum.qValue < 0.05;
        }
        if (isGenericAssayData) {
            result =
                result &&
                filterFunction(
                    (enrichmentDatum as GenericAssayEnrichmentRow).stableId
                );
        } else {
            result =
                result &&
                filterFunction(
                    (enrichmentDatum as
                        | ExpressionEnrichmentRow
                        | AlterationEnrichmentRow).hugoGeneSymbol
                );
        }

        return result;
    });
}

export function getBarChartTooltipContent(
    tooltipModel: any,
    selectedGene: string
): string {
    let tooltipContent = '';

    if (tooltipModel != null) {
        const datum = tooltipModel.datum;
        tooltipContent += 'Query Genes ';
        if (datum.x == 2) {
            if (datum.index == 0) {
                tooltipContent += 'Altered: ';
            } else {
                tooltipContent += 'Unaltered: ';
            }
        } else {
            if (datum.index == 0) {
                tooltipContent += 'Altered, ' + selectedGene + ' Unaltered: ';
            } else if (datum.index == 1) {
                tooltipContent += 'Altered, ' + selectedGene + ' Altered: ';
            } else if (datum.index == 2) {
                tooltipContent += 'Unaltered, ' + selectedGene + ' Altered: ';
            } else if (datum.index == 3) {
                tooltipContent += 'Unaltered, ' + selectedGene + ' Unaltered: ';
            }
        }

        tooltipContent += datum.y;
    }
    return tooltipContent;
}

export function getAlterationsTooltipContent(alterations: any[]): string {
    let result: string = '';
    let currentGene: string;
    alterations.forEach(a => {
        const hugoGeneSymbol = a.gene.hugoGeneSymbol;
        if (hugoGeneSymbol != currentGene) {
            result += hugoGeneSymbol + ': ';
        }
        if (a.alterationType === 'MUTATION_EXTENDED') {
            result += 'MUT';
        } else if (a.alterationType === 'PROTEIN_LEVEL') {
            result += 'RPPA-' + a.alterationSubType.toUpperCase();
        } else {
            result += a.alterationSubType.toUpperCase();
        }
        result += '; ';
        currentGene = hugoGeneSymbol;
    });

    return result;
}

export function pickMutationEnrichmentProfiles(profiles: MolecularProfile[]) {
    return _.filter(
        profiles,
        (profile: MolecularProfile) =>
            profile.molecularAlterationType ===
            AlterationTypeConstants.MUTATION_EXTENDED
    );
}

export function pickStructuralVariantEnrichmentProfiles(
    profiles: MolecularProfile[]
) {
    return _.filter(
        profiles,
        (profile: MolecularProfile) =>
            profile.molecularAlterationType ===
                AlterationTypeConstants.STRUCTURAL_VARIANT ||
            profile.molecularAlterationType === AlterationTypeConstants.FUSION
    );
}

export function pickCopyNumberEnrichmentProfiles(profiles: MolecularProfile[]) {
    return _.filter(
        profiles,
        (profile: MolecularProfile) =>
            profile.molecularAlterationType ===
                AlterationTypeConstants.COPY_NUMBER_ALTERATION &&
            profile.datatype === 'DISCRETE'
    );
}

export function pickMRNAEnrichmentProfiles(profiles: MolecularProfile[]) {
    const mrnaProfiles = profiles.filter(p => {
        return (
            p.molecularAlterationType ===
            AlterationTypeConstants.MRNA_EXPRESSION
        );
    });
    return filterAndSortProfiles(mrnaProfiles);
}

export function pickProteinEnrichmentProfiles(profiles: MolecularProfile[]) {
    const protProfiles = profiles.filter(p => {
        return (
            p.molecularAlterationType === AlterationTypeConstants.PROTEIN_LEVEL
        );
    });
    return filterAndSortProfiles(protProfiles);
}

export function pickMethylationEnrichmentProfiles(
    profiles: MolecularProfile[]
) {
    return profiles.filter(p => {
        return (
            p.molecularAlterationType === AlterationTypeConstants.METHYLATION
        );
    });
}

export function pickGenericAssayEnrichmentProfiles(
    profiles: MolecularProfile[]
) {
    // TODO: Pick profiles from all Generic Assay dataTypes after we implement related features
    return profiles.filter(p => {
        return (
            p.molecularAlterationType ===
                AlterationTypeConstants.GENERIC_ASSAY &&
            p.datatype === DataTypeConstants.LIMITVALUE
        );
    });
}

export function getAlterationEnrichmentColumns(
    groups: { name: string; description: string; color?: string }[],
    alteredVsUnalteredMode?: boolean
): AlterationEnrichmentTableColumn[] {
    let columns: AlterationEnrichmentTableColumn[] = [];
    const nameToGroup = _.keyBy(groups, g => g.name);

    let enrichedGroupColum: AlterationEnrichmentTableColumn = {
        name: alteredVsUnalteredMode
            ? AlterationEnrichmentTableColumnType.TENDENCY
            : groups.length === 2
            ? AlterationEnrichmentTableColumnType.ENRICHED
            : AlterationEnrichmentTableColumnType.MOST_ENRICHED,
        render: (d: AlterationEnrichmentRow) => {
            if (d.enrichedGroup === undefined || d.qValue === undefined) {
                return <span>-</span>;
            }
            let groupColor = undefined;
            const significant = d.qValue < 0.05;
            if (!alteredVsUnalteredMode && significant) {
                groupColor = nameToGroup[d.enrichedGroup].color;
            }
            return (
                <div
                    className={classNames(styles.Tendency, {
                        [styles.Significant]: significant,
                        [styles.ColoredBackground]: !!groupColor,
                    })}
                    style={{
                        backgroundColor: groupColor,
                        color: groupColor && getTextColor(groupColor),
                    }}
                >
                    {alteredVsUnalteredMode
                        ? d.enrichedGroup
                        : formatAlterationTendency(d.enrichedGroup)}
                </div>
            );
        },
        filter: (
            d: AlterationEnrichmentRow,
            filterString: string,
            filterStringUpper: string
        ) => (d.enrichedGroup || '').toUpperCase().includes(filterStringUpper),
        sortBy: (d: AlterationEnrichmentRow) => d.enrichedGroup || '-',
        download: (d: AlterationEnrichmentRow) => d.enrichedGroup || '-',
        tooltip: <span>The group with the highest alteration frequency</span>,
    };

    //minimum 2 group are required for enrichment analysis
    if (groups.length < 2) {
        return [];
    }

    if (groups.length === 2) {
        let group1 = groups[0];
        let group2 = groups[1];
        columns.push({
            name: AlterationEnrichmentTableColumnType.LOG_RATIO,
            render: (d: AlterationEnrichmentRow) => (
                <span>{d.logRatio ? formatLogOddsRatio(d.logRatio) : '-'}</span>
            ),
            tooltip: (
                <span>
                    Log2 based ratio of (pct in {group1.name}/ pct in{' '}
                    {group2.name})
                </span>
            ),
            sortBy: (d: AlterationEnrichmentRow) => Number(d.logRatio),
            download: (d: AlterationEnrichmentRow) =>
                d.logRatio ? formatLogOddsRatio(d.logRatio) : '-',
        });

        enrichedGroupColum.tooltip = (
            <table>
                <tr>
                    <td>Log ratio {'>'} 0</td>
                    <td>: Enriched in {group1.name}</td>
                </tr>
                <tr>
                    <td>Log ratio &lt;= 0</td>
                    <td>: Enriched in {group2.name}</td>
                </tr>
                <tr>
                    <td>q-Value &lt; 0.05</td>
                    <td>: Significant association</td>
                </tr>
            </table>
        );
    }
    columns.push(enrichedGroupColum);
    groups.forEach(group => {
        columns.push({
            name: group.name,
            headerRender: PERCENTAGE_IN_headerRender,
            render: (d: AlterationEnrichmentRow) => {
                let overlay = (
                    <span>
                        {getProfiledCount(group.name, d)} samples in{' '}
                        {group.name} are profiled for {d.hugoGeneSymbol},&nbsp;
                        {formatPercentage(group.name, d)} of which are altered
                        in {d.hugoGeneSymbol}
                    </span>
                );
                return (
                    <DefaultTooltip
                        destroyTooltipOnHide={true}
                        trigger={['hover']}
                        overlay={overlay}
                    >
                        <span data-test={`${group.name}-CountCell`}>
                            {formatPercentage(group.name, d)}
                        </span>
                    </DefaultTooltip>
                );
            },
            tooltip: (
                <span>
                    <strong>{group.name}:</strong> {group.description}
                </span>
            ),
            sortBy: (d: AlterationEnrichmentRow) =>
                getAlteredCount(group.name, d),
            download: (d: AlterationEnrichmentRow) =>
                formatPercentage(group.name, d),
        });
    });
    return columns;
}

export function getEnrichmentColumns(
    groups: { name: string; description: string; color?: string }[],
    enrichmentType: EnrichmentType,
    alteredVsUnalteredMode?: boolean
): ExpressionEnrichmentTableColumn[] {
    // minimum 2 group are required for enrichment analysis
    if (groups.length < 2) {
        return [];
    }
    let columns: ExpressionEnrichmentTableColumn[] = [];
    const nameToGroup = _.keyBy(groups, g => g.name);
    const isMethylation = enrichmentType === EnrichmentType.DNA_METHYLATION;
    const typeOfEnrichment = isMethylation ? 'methylation' : 'expression';

    let enrichedGroupColum: ExpressionEnrichmentTableColumn = {
        name: alteredVsUnalteredMode
            ? ExpressionEnrichmentTableColumnType.TENDENCY
            : isMethylation
            ? ExpressionEnrichmentTableColumnType.METHYLATION
            : ExpressionEnrichmentTableColumnType.EXPRESSED,
        render: (d: ExpressionEnrichmentRow) => {
            if (d.pValue === undefined) {
                return <span>-</span>;
            }
            let groupColor = undefined;
            const significant = d.qValue < 0.05;
            if (!alteredVsUnalteredMode && significant) {
                groupColor = nameToGroup[d.enrichedGroup].color;
            }
            return (
                <div
                    className={classNames(styles.Tendency, {
                        [styles.Significant]: significant,
                        [styles.ColoredBackground]: !!groupColor,
                    })}
                    style={{
                        backgroundColor: groupColor,
                        color: groupColor && getTextColor(groupColor),
                    }}
                >
                    {alteredVsUnalteredMode
                        ? d.enrichedGroup
                        : formatAlterationTendency(d.enrichedGroup)}
                </div>
            );
        },
        filter: (
            d: ExpressionEnrichmentRow,
            filterString: string,
            filterStringUpper: string
        ) => d.enrichedGroup.toUpperCase().includes(filterStringUpper),
        sortBy: (d: ExpressionEnrichmentRow) => d.enrichedGroup,
        download: (d: ExpressionEnrichmentRow) => d.enrichedGroup,
        tooltip: (
            <span>The group with the highest {typeOfEnrichment} frequency</span>
        ),
    };

    if (groups.length === 2) {
        let group1 = groups[0];
        let group2 = groups[1];
        columns.push({
            name: ExpressionEnrichmentTableColumnType.LOG_RATIO,
            render: (d: ExpressionEnrichmentRow) => (
                <span>{formatLogOddsRatio(d.logRatio!)}</span>
            ),
            tooltip: (
                <span>
                    Log2 of ratio of {isMethylation ? '' : '(unlogged)'} mean in{' '}
                    {group1.name} to {isMethylation ? '' : '(unlogged)'} mean in{' '}
                    {group2.name}
                </span>
            ),
            sortBy: (d: ExpressionEnrichmentRow) => Number(d.logRatio),
            download: (d: ExpressionEnrichmentRow) =>
                formatLogOddsRatio(d.logRatio!),
        });

        enrichedGroupColum.tooltip = (
            <table>
                <tr>
                    <td>Log ratio {'>'} 0</td>
                    <td>: Enriched in {group1.name}</td>
                </tr>
                <tr>
                    <td>Log ratio &lt;= 0</td>
                    <td>: Enriched in {group2.name}</td>
                </tr>
                <tr>
                    <td>q-Value &lt; 0.05</td>
                    <td>: Significant association</td>
                </tr>
            </table>
        );
    }
    columns.push(enrichedGroupColum);
    groups.forEach(group => {
        columns.push({
            name: group.name,
            headerRender: (name: string) => STAT_IN_headerRender('μ', name),
            render: (d: ExpressionEnrichmentRow) => (
                <span>
                    {d.groupsSet[group.name]
                        ? d.groupsSet[group.name].meanExpression.toFixed(2)
                        : Datalabel.NA}
                </span>
            ),
            tooltip: (
                <span>
                    Mean {isMethylation ? '' : 'log2'} {typeOfEnrichment} of the
                    listed gene in {group.description}
                </span>
            ),
            sortBy: (d: ExpressionEnrichmentRow) =>
                d.groupsSet[group.name]
                    ? d.groupsSet[group.name].meanExpression
                    : null,
            download: (d: ExpressionEnrichmentRow) =>
                d.groupsSet[group.name]
                    ? d.groupsSet[group.name].meanExpression.toFixed(2)
                    : Datalabel.NA,
            uniqueName:
                group.name + ExpressionEnrichmentTableColumnType.MEAN_SUFFIX,
        });

        columns.push({
            name: group.name,
            headerRender: (name: string) => STAT_IN_headerRender('σ', name),
            render: (d: ExpressionEnrichmentRow) => (
                <span>
                    {d.groupsSet[group.name]
                        ? d.groupsSet[group.name].standardDeviation.toFixed(2)
                        : Datalabel.NA}
                </span>
            ),
            tooltip: (
                <span>
                    Standard deviation of {isMethylation ? '' : 'log2'}{' '}
                    {typeOfEnrichment} of the listed gene in {group.description}
                </span>
            ),
            sortBy: (d: ExpressionEnrichmentRow) =>
                d.groupsSet[group.name]
                    ? d.groupsSet[group.name].standardDeviation
                    : null,
            download: (d: ExpressionEnrichmentRow) =>
                d.groupsSet[group.name]
                    ? d.groupsSet[group.name].standardDeviation.toFixed(2)
                    : Datalabel.NA,
            uniqueName:
                group.name +
                ExpressionEnrichmentTableColumnType.STANDARD_DEVIATION_SUFFIX,
        });
    });
    return columns;
}

export function getGenericAssayEnrichmentColumns(
    groups: { name: string; description: string; color?: string }[],
    alteredVsUnalteredMode?: boolean
): GenericAssayEnrichmentTableColumn[] {
    // minimum 2 group are required for enrichment analysis
    if (groups.length < 2) {
        return [];
    }
    let columns: GenericAssayEnrichmentTableColumn[] = [];
    const nameToGroup = _.keyBy(groups, g => g.name);

    let enrichedGroupColum: GenericAssayEnrichmentTableColumn = {
        name: alteredVsUnalteredMode
            ? GenericAssayEnrichmentTableColumnType.TENDENCY
            : GenericAssayEnrichmentTableColumnType.EXPRESSED,
        render: (d: GenericAssayEnrichmentRow) => {
            if (d.pValue === undefined) {
                return <span>-</span>;
            }
            let groupColor = undefined;
            const significant = d.qValue < 0.05;
            if (!alteredVsUnalteredMode && significant) {
                groupColor = nameToGroup[d.enrichedGroup].color;
            }
            return (
                <div
                    className={classNames(styles.Tendency, {
                        [styles.Significant]: significant,
                        [styles.ColoredBackground]: !!groupColor,
                    })}
                    style={{
                        backgroundColor: groupColor,
                        color: groupColor && getTextColor(groupColor),
                    }}
                >
                    {alteredVsUnalteredMode
                        ? d.enrichedGroup
                        : formatAlterationTendency(d.enrichedGroup)}
                </div>
            );
        },
        filter: (
            d: GenericAssayEnrichmentRow,
            filterString: string,
            filterStringUpper: string
        ) => d.enrichedGroup.toUpperCase().includes(filterStringUpper),
        sortBy: (d: GenericAssayEnrichmentRow) => d.enrichedGroup,
        download: (d: GenericAssayEnrichmentRow) => d.enrichedGroup,
        tooltip: <span>The group with the highest frequency</span>,
    };

    if (groups.length === 2) {
        let group1 = groups[0];
        let group2 = groups[1];
        columns.push({
            name: GenericAssayEnrichmentTableColumnType.LOG_RATIO,
            render: (d: GenericAssayEnrichmentRow) => (
                <span>{formatLogOddsRatio(d.logRatio!)}</span>
            ),
            tooltip: (
                <span>
                    Log2 of ratio of mean in {group1.name} to mean in{' '}
                    {group2.name}
                </span>
            ),
            sortBy: (d: GenericAssayEnrichmentRow) => Number(d.logRatio),
            download: (d: GenericAssayEnrichmentRow) =>
                formatLogOddsRatio(d.logRatio!),
        });

        enrichedGroupColum.tooltip = (
            <table>
                <tr>
                    <td>Log ratio {'>'} 0</td>
                    <td>: Enriched in {group1.name}</td>
                </tr>
                <tr>
                    <td>Log ratio &lt;= 0</td>
                    <td>: Enriched in {group2.name}</td>
                </tr>
                <tr>
                    <td>q-Value &lt; 0.05</td>
                    <td>: Significant association</td>
                </tr>
            </table>
        );
    }
    columns.push(enrichedGroupColum);
    groups.forEach(group => {
        columns.push({
            name: group.name,
            headerRender: (name: string) => STAT_IN_headerRender('μ', name),
            render: (d: GenericAssayEnrichmentRow) => (
                <span>
                    {d.groupsSet[group.name]
                        ? d.groupsSet[group.name].meanExpression.toFixed(2)
                        : Datalabel.NA}
                </span>
            ),
            tooltip: (
                <span>Mean of the listed entity in {group.description}</span>
            ),
            sortBy: (d: GenericAssayEnrichmentRow) =>
                d.groupsSet[group.name]
                    ? d.groupsSet[group.name].meanExpression
                    : null,
            download: (d: GenericAssayEnrichmentRow) =>
                d.groupsSet[group.name]
                    ? d.groupsSet[group.name].meanExpression.toFixed(2)
                    : Datalabel.NA,
            uniqueName:
                group.name + GenericAssayEnrichmentTableColumnType.MEAN_SUFFIX,
        });

        columns.push({
            name: group.name,
            headerRender: (name: string) => STAT_IN_headerRender('σ', name),
            render: (d: GenericAssayEnrichmentRow) => (
                <span>
                    {d.groupsSet[group.name]
                        ? d.groupsSet[group.name].standardDeviation.toFixed(2)
                        : Datalabel.NA}
                </span>
            ),
            tooltip: (
                <span>
                    Standard deviation of the listed entity in{' '}
                    {group.description}
                </span>
            ),
            sortBy: (d: GenericAssayEnrichmentRow) =>
                d.groupsSet[group.name]
                    ? d.groupsSet[group.name].standardDeviation
                    : null,
            download: (d: GenericAssayEnrichmentRow) =>
                d.groupsSet[group.name]
                    ? d.groupsSet[group.name].standardDeviation.toFixed(2)
                    : Datalabel.NA,
            uniqueName:
                group.name +
                GenericAssayEnrichmentTableColumnType.STANDARD_DEVIATION_SUFFIX,
        });
    });
    return columns;
}

export function getEnrichmentBarPlotData(
    data: { [gene: string]: AlterationEnrichmentRow },
    genes: string[]
): IMultipleCategoryBarPlotData[] {
    const usedGenes: { [gene: string]: boolean } = {};
    if (_.isEmpty(genes)) {
        return [];
    }

    const groupToGeneCounts = _.reduce(
        genes,
        (acc, gene) => {
            const datum = data[gene];
            if (datum) {
                _.each(datum.groupsSet, group => {
                    const groupName = group.name;
                    if (!acc[groupName]) {
                        acc[groupName] = {};
                    }
                    const displayedGeneName =
                        gene + (datum.qValue && datum.qValue < 0.05 ? '*' : '');
                    acc[groupName][displayedGeneName] = group.alteredPercentage;
                    usedGenes[displayedGeneName] = true;
                });
            }
            return acc;
        },
        {} as { [group: string]: { [gene: string]: number } }
    );

    const geneTotalCounts: { [id: string]: number } = {};
    // ensure entries for all used minor categories - we need 0 entries for those major/minor combos we didnt see
    _.forEach(usedGenes, (z, gene) => {
        let totalCount = 0;
        _.forEach(groupToGeneCounts, geneCounts => {
            geneCounts[gene] = geneCounts[gene] || 0;
            totalCount += geneCounts[gene];
        });
        geneTotalCounts[gene] = totalCount;
    });

    return _.map(
        groupToGeneCounts,
        (geneCounts: { [gene: string]: number }, group) => {
            let counts = _.map(geneCounts, (count, gene) => {
                const percentage = (count / geneTotalCounts[gene]) * 100;
                return {
                    majorCategory: gene,
                    count: count,
                    percentage: parseFloat(percentage.toFixed(2)),
                };
            });
            return {
                minorCategory: group,
                counts,
            };
        }
    );
}

export function compareByAlterationPercentage(
    kv1: AlterationEnrichmentRow,
    kv2: AlterationEnrichmentRow
) {
    const t1 = _.reduce(
        kv1.groupsSet,
        (acc, next) => {
            acc = next.alteredPercentage > acc ? next.alteredPercentage : acc;
            return acc;
        },
        0
    );
    const t2 = _.reduce(
        kv2.groupsSet,
        (acc, next) => {
            acc = next.alteredPercentage > acc ? next.alteredPercentage : acc;
            return acc;
        },
        0
    );
    return t2 - t1;
}

export function getGeneListOptions(
    data: AlterationEnrichmentRow[],
    includeAlteration?: boolean
): { label: GeneOptionLabel; genes: string[] }[] {
    if (_.isEmpty(data)) {
        return [
            {
                label: GeneOptionLabel.USER_DEFINED_OPTION,
                genes: [],
            },
        ];
    }

    let dataWithOptionName: (AlterationEnrichmentRow & {
        optionName?: string;
    })[] = data;

    if (includeAlteration) {
        dataWithOptionName = _.map(dataWithOptionName, datum => {
            return {
                ...datum,
                optionName:
                    datum.hugoGeneSymbol +
                    `: ${CNA_TO_ALTERATION[datum.value!]}`,
            };
        });
    }

    let dataSortedByAlteredPercentage = _.clone(dataWithOptionName).sort(
        compareByAlterationPercentage
    );

    let dataSortedByAvgFrequency = _.clone(dataWithOptionName).sort(function(
        kv1,
        kv2
    ) {
        const t1 =
            _.sumBy(_.values(kv1.groupsSet), count => count.alteredPercentage) /
            _.keys(kv1.groupsSet).length;
        const t2 =
            _.sumBy(_.values(kv2.groupsSet), count => count.alteredPercentage) /
            _.keys(kv2.groupsSet).length;
        return t2 - t1;
    });

    let dataSortedBypValue = _.clone(dataWithOptionName).sort(function(
        kv1,
        kv2
    ) {
        if (kv1.pValue !== undefined && kv2.pValue !== undefined) {
            return 0;
        }
        if (kv1.pValue !== undefined) {
            return 1;
        }
        if (kv2.pValue !== undefined) {
            return -1;
        }
        return Number(kv1.pValue) - Number(kv2.pValue);
    });

    return [
        {
            label: GeneOptionLabel.USER_DEFINED_OPTION,
            genes: [],
        },
        {
            label: GeneOptionLabel.HIGHEST_FREQUENCY,
            genes: _.map(
                dataSortedByAlteredPercentage,
                datum => datum.optionName || datum.hugoGeneSymbol
            ),
        },
        {
            label: GeneOptionLabel.AVERAGE_FREQUENCY,
            genes: _.map(
                dataSortedByAvgFrequency,
                datum => datum.optionName || datum.hugoGeneSymbol
            ),
        },
        {
            label: GeneOptionLabel.SIGNIFICANT_P_VALUE,
            genes: _.map(
                dataSortedBypValue,
                datum => datum.optionName || datum.hugoGeneSymbol
            ),
        },
        {
            label: GeneOptionLabel.SYNC_WITH_TABLE,
            genes: [],
        },
    ];
}

export const ContinousDataPvalueTooltip: React.FunctionComponent<ContinousDataPvalueTooltipProps> = ({
    groupSize,
}) => {
    return (
        <span>
            {groupSize && groupSize >= PVALUE_TEST_GROUP_SIZE_THRESHOLD
                ? 'Derived from one-way ANOVA'
                : "Derived from Student's t-test"}
        </span>
    );
};
