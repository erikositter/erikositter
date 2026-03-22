export type UserRole = 'parent' | 'sitter';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

export interface ChildProfile {
  name: string;
  birthday: string;
  gender: '男の子' | '女の子' | 'その他';
  allergies?: string;
  notes?: string;
}

export interface Contract {
  id: string;
  parentId: string;
  sitterId: string;
  status: 'pending' | 'active' | 'completed';
  childProfile?: ChildProfile;
  content: string;
  createdAt: string;
}

export interface TimelineItem {
  time: string;
  content: string;
  type: 'activity' | 'meal' | 'sleep' | 'other';
}

export interface ActivityReport {
  id: string;
  contractId: string;
  sitterId: string;
  parentId: string;
  date: string;
  timeline: TimelineItem[];
  summary: string;
  mood: string;
  createdAt: string;
}

export interface NapCheckItem {
  time: string;
  position: '仰向け' | 'うつ伏せ' | '右向き' | '左向き';
  note: string;
}

export interface NapCheck {
  id: string;
  contractId: string;
  sitterId: string;
  parentId: string;
  date: string;
  checks: NapCheckItem[];
  createdAt: string;
}
