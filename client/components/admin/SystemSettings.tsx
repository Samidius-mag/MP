'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface SystemSetting {
  value: any;
  description: string;
}

interface Settings {
  [key: string]: SystemSetting;
}

export default function SystemSettings() {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedSettings, setEditedSettings] = useState<Settings>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/settings');
      setSettings(response.data);
      setEditedSettings(response.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка загрузки настроек');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key: string, value: any) => {
    setEditedSettings(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        value: value
      }
    }));
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      
      // Prepare settings for API
      const settingsToSave: { [key: string]: { value: any } } = {};
      Object.entries(editedSettings).forEach(([key, setting]) => {
        if (JSON.stringify(setting.value) !== JSON.stringify(settings[key]?.value)) {
          settingsToSave[key] = { value: setting.value };
        }
      });

      if (Object.keys(settingsToSave).length === 0) {
        toast.success('Настройки не изменились');
        return;
      }

      await api.put('/admin/settings', { settings: settingsToSave });
      setSettings(editedSettings);
      toast.success('Настройки успешно сохранены');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка сохранения настроек');
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = () => {
    setEditedSettings(settings);
  };

  const hasChanges = () => {
    return JSON.stringify(editedSettings) !== JSON.stringify(settings);
  };

  const renderSettingInput = (key: string, setting: SystemSetting) => {
    const value = setting.value;
    const type = typeof value;

    if (type === 'boolean') {
      return (
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => handleSettingChange(key, e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700">
            {value ? 'Включено' : 'Отключено'}
          </span>
        </div>
      );
    }

    if (type === 'number') {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => handleSettingChange(key, parseFloat(e.target.value) || 0)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      );
    }

    if (type === 'object' && value !== null) {
      return (
        <textarea
          value={JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              handleSettingChange(key, parsed);
            } catch (err) {
              // Invalid JSON, keep the text but don't update the value
            }
          }}
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
        />
      );
    }

    // String or other types
    return (
      <input
        type="text"
        value={value || ''}
        onChange={(e) => handleSettingChange(key, e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Настройки системы</h2>
        <p className="text-gray-600">Конфигурация параметров системы</p>
      </div>

      {/* Action Buttons */}
      <div className="mb-6 flex justify-between items-center">
        <div className="flex space-x-3">
          <button
            onClick={saveSettings}
            disabled={saving || !hasChanges()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
          
          <button
            onClick={resetSettings}
            disabled={!hasChanges()}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Сбросить
          </button>
        </div>

        {hasChanges() && (
          <div className="text-sm text-orange-600 font-medium">
            Есть несохраненные изменения
          </div>
        )}
      </div>

      {/* Settings List */}
      <div className="space-y-6">
        {Object.entries(editedSettings).map(([key, setting]) => (
          <div key={key} className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </h3>
              {setting.description && (
                <p className="text-sm text-gray-600">{setting.description}</p>
              )}
            </div>
            
            <div className="max-w-2xl">
              {renderSettingInput(key, setting)}
            </div>
          </div>
        ))}

        {Object.keys(editedSettings).length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Нет настроек</h3>
              <p className="mt-1 text-sm text-gray-500">
                Настройки системы не найдены или не загружены.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}





