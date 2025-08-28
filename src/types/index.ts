export interface User {
  id: string;
  name: string;
  email: string;
  university: string;
  role: 'Student' | 'Professor' | 'Faculty';
  degree?: string;
}

export interface SurveyData {
  university: string;
  role: string;
}

export interface Event {
  id: string;
  title: string;
  type: 'clinic' | 'power-hour' | 'club' | 'sponsored';
  date: string;
  time: string;
  location?: string;
}

export interface MarketplaceItem {
  id: string;
  title: string;
  price: number;
  category: 'textbook' | 'job' | 'errand';
  seller: string;
  description: string;
}