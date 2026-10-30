export type TabType = 'collections' | 'borrowers' | 'new-loan' | 'insights';

export interface NavTabItem {
  id: TabType;
  labelEn: string;
  labelTe: string;
}

