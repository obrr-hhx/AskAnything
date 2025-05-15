import { AIModel, UserSettings } from './models';

// 默认设置
const DEFAULT_SETTINGS: UserSettings = {
  preferredModel: 'chatgpt'
};

/**
 * 获取用户设置
 */
export const getSettings = (): Promise<UserSettings> => {
  return new Promise((resolve) => {
    chrome.storage.sync.get('userSettings', (result) => {
      if (result.userSettings) {
        resolve(result.userSettings as UserSettings);
      } else {
        // 如果没有设置，使用默认设置并保存
        saveSettings(DEFAULT_SETTINGS);
        resolve(DEFAULT_SETTINGS);
      }
    });
  });
};

/**
 * 保存用户设置
 */
export const saveSettings = (settings: UserSettings): Promise<void> => {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ userSettings: settings }, () => {
      resolve();
    });
  });
};

/**
 * 设置首选模型
 */
export const setPreferredModel = async (model: AIModel): Promise<void> => {
  const settings = await getSettings();
  settings.preferredModel = model;
  await saveSettings(settings);
}; 