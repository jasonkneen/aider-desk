import { useState, ReactNode } from 'react';
import { useDebounce } from '@reactuses/core';
import { useTranslation } from 'react-i18next';
import { FiEdit2, FiTrash2, FiPlus, FiEye, FiSliders, FiRefreshCw } from 'react-icons/fi';
import { Model, ProviderProfile } from '@common/types';
import { MdThermostat } from 'react-icons/md';

import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Checkbox } from '@/components/common/Checkbox';
import { Column } from '@/components/common/Table';
import { VirtualTable } from '@/components/common/VirtualTable';
import { IconButton } from '@/components/common/IconButton';
import { StyledTooltip } from '@/components/common/StyledTooltip';

type Props = {
  models: Model[];
  selectedProviderIds: string[];
  providers: ProviderProfile[];
  onAddModel: () => void;
  onEditModel: (model: Model) => void;
  onDeleteModel: (model: Model) => void;
  onToggleHidden: (model: Model) => void;
  onRefreshModels: () => void;
  modelsLoading?: boolean;
};

export const ModelTableSection = ({
  models,
  selectedProviderIds,
  providers,
  onAddModel,
  onEditModel,
  onDeleteModel,
  onToggleHidden,
  onRefreshModels,
  modelsLoading = false,
}: Props) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const filteredModels = models.filter((model) => {
    const matchesSearch = model.id.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchesProvider = selectedProviderIds.length === 0 || selectedProviderIds.includes(model.providerId);
    const matchesHidden = showHidden || !model.isHidden;
    return matchesSearch && matchesProvider && matchesHidden;
  });

  const getRowClassName = (row: Model) => {
    if (row.isHidden) {
      return 'text-text-muted-dark';
    }
    return undefined;
  };

  const columns: Column<Model>[] = [
    {
      accessor: 'id',
      header: t('modelLibrary.modelId'),
      cell: (value) => value as ReactNode,
      cellClassName: 'text-xs',
    },
    {
      accessor: 'providerId',
      header: t('modelLibrary.provider'),
      cell: (value) => {
        const provider = providers.find((p) => p.id === value);
        return provider ? provider.name || t(`providers.${provider.provider.name}`) : (value as ReactNode);
      },
      cellClassName: 'text-xs',
    },
    {
      accessor: 'maxInputTokens',
      header: t('modelLibrary.maxInputTokens'),
      align: 'center',
      maxWidth: 150,
      cellClassName: 'text-xs',
      sort: (a, b) => (a.maxInputTokens || 0) - (b.maxInputTokens || 0),
    },
    {
      accessor: 'inputCostPerToken',
      header: t('modelLibrary.inputCost'),
      cell: (value) => {
        if (value === undefined || value === null) {
          return '';
        }
        return `${(Number(value) * 1000000).toFixed(2)}`;
      },
      align: 'center',
      maxWidth: 150,
      cellClassName: 'text-xs',
      sort: (a, b) => (a.inputCostPerToken || 0) - (b.inputCostPerToken || 0),
    },
    {
      accessor: 'cacheReadInputTokenCost',
      header: t('modelLibrary.cachedInput'),
      cell: (value) => {
        if (value === undefined || value === null) {
          return '';
        }
        return `${(Number(value) * 1000000).toFixed(2)}`;
      },
      align: 'center',
      maxWidth: 150,
      cellClassName: 'text-xs',
      sort: (a, b) => (a.cacheReadInputTokenCost || 0) - (b.cacheReadInputTokenCost || 0),
    },
    {
      accessor: 'cacheWriteInputTokenCost',
      header: t('modelLibrary.cacheWrites'),
      cell: (value) => {
        if (value === undefined || value === null) {
          return '';
        }
        return `${(Number(value) * 1000000).toFixed(2)}`;
      },
      align: 'center',
      maxWidth: 150,
      cellClassName: 'text-xs',
      sort: (a, b) => (a.cacheWriteInputTokenCost || 0) - (b.cacheWriteInputTokenCost || 0),
    },
    {
      accessor: 'outputCostPerToken',
      header: t('modelLibrary.outputCost'),
      cell: (value) => {
        if (value === undefined || value === null) {
          return '';
        }
        return `${(Number(value) * 1000000).toFixed(2)}`;
      },
      align: 'center',
      maxWidth: 150,
      cellClassName: 'text-xs',
      sort: (a, b) => (a.outputCostPerToken || 0) - (b.outputCostPerToken || 0),
    },
    {
      accessor: 'maxOutputTokens',
      header: t('modelLibrary.maxOutputTokens'),
      align: 'center',
      maxWidth: 180,
      cellClassName: 'text-xs',
      sort: (a, b) => (a.maxOutputTokens || 0) - (b.maxOutputTokens || 0),
    },
    {
      accessor: 'temperature',
      header: (
        <MdThermostat className="w-4 h-4 text-text-secondary" data-tooltip-id="model-table-tooltip" data-tooltip-content={t('modelLibrary.temperature')} />
      ),
      align: 'center',
      maxWidth: 50,
      cellClassName: 'text-xs',
      sort: (a, b) => {
        if (a.temperature === undefined && b.temperature === undefined) {
          return 0;
        }
        if (a.temperature === undefined) {
          return 1;
        }
        if (b.temperature === undefined) {
          return -1;
        }
        return (a.temperature || 0) - (b.temperature || 0);
      },
    },
    {
      header: '',
      cell: (_, row) => (
        <div className="flex items-center justify-end space-x-2">
          <IconButton icon={<FiEdit2 className="w-4 h-4" />} onClick={() => onEditModel(row)} />
          <IconButton
            icon={<FiEye className="w-4 h-4" />}
            onClick={() => onToggleHidden(row)}
            tooltip={row.isHidden ? t('modelLibrary.showModel') : t('modelLibrary.hideModel')}
          />
          {row.providerOverrides && Object.keys(row.providerOverrides).length > 0 && (
            <IconButton icon={<FiSliders className="w-4 h-4 text-text-secondary" />} tooltip={t('modelLibrary.overrides.overridesProviderParameters')} />
          )}
          {row.isCustom && (
            <IconButton icon={<FiTrash2 className="w-4 h-4" />} onClick={() => onDeleteModel(row)} className="text-error hover:text-error-light" />
          )}
        </div>
      ),
      align: 'left',
      maxWidth: 110,
    },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <StyledTooltip id="model-table-tooltip" />
      {/* Search and Info Header */}
      <div className="px-2 pt-2">
        <div className="flex items-center justify-between space-x-4 pr-4">
          <div className="flex items-center space-x-4">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              wrapperClassName="min-w-[250px] flex-1 max-w-md"
              placeholder={t('modelLibrary.searchPlaceholder')}
            />
            <Checkbox label={t('modelLibrary.showHidden')} checked={showHidden} onChange={setShowHidden} size="sm" />
            <div className="text-2xs text-text-secondary pr-2 pl-4">
              {selectedProviderIds.length === 0
                ? t('modelLibrary.showingAllModels', { count: filteredModels.length })
                : t('modelLibrary.showingModelsFromProviders', {
                    modelCount: filteredModels.length,
                    providerCount: selectedProviderIds.length,
                  })}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button onClick={onRefreshModels} size="sm" variant="text" disabled={modelsLoading}>
              <FiRefreshCw className={`w-4 h-4 mr-2 ${modelsLoading ? 'animate-spin' : ''}`} />
              {t('modelLibrary.refresh')}
            </Button>
            <Button onClick={onAddModel} size="sm" variant="text">
              <FiPlus className="w-4 h-4 mr-2" />
              {t('modelLibrary.addModel')}
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex flex-1 overflow-hidden mt-2">
        {filteredModels.length === 0 ? (
          <div className="flex items-center justify-center h-full w-full">
            <div className="text-center">
              <p className="text-text-secondary text-sm">
                {search
                  ? t('modelLibrary.noModelsMatchSearch')
                  : selectedProviderIds.length === 0
                    ? t('modelLibrary.selectProvidersToViewModels')
                    : t('modelLibrary.noModelsFromSelectedProviders')}
              </p>
            </div>
          </div>
        ) : (
          <VirtualTable data={filteredModels} columns={columns} getRowClassName={getRowClassName} />
        )}
      </div>
    </div>
  );
};
