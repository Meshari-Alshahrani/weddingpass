export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  bgMain: string;
  bgCard: string;
  textPrimary: string;
  textSecondary: string;
  accentGold: string;
  borderAccent: string;
  cardGlow: string;
  fontHeading: string;
  fontBody: string;
  ornamentStyle: 'gold_arch' | 'emerald_minimal' | 'floral_rose';
}

export const THEMES: Record<string, ThemeConfig> = {
  classic_gold: {
    id: 'classic_gold',
    name: 'الذهب الأسود الملكي (Classic Luxury)',
    description: 'فخامة الأسود الملكي والذهب الخالص مع الزخارف الكلاسيكية الأصيلة',
    bgMain: 'bg-slate-950',
    bgCard: 'bg-slate-900/90 backdrop-blur-xl border border-amber-500/30',
    textPrimary: 'text-amber-100',
    textSecondary: 'text-amber-200/70',
    accentGold: '#D4AF37',
    borderAccent: 'border-amber-500/40',
    cardGlow: 'shadow-[0_0_50px_-12px_rgba(212,175,55,0.25)]',
    fontHeading: 'font-serif',
    fontBody: 'font-sans',
    ornamentStyle: 'gold_arch',
  },
  modern_royal: {
    id: 'modern_royal',
    name: 'الزمرد الرخامي (Modern Royal)',
    description: 'أناقة الرخام العاجي ولمسات الزمرد الأخضر المعاصرة',
    bgMain: 'bg-stone-100',
    bgCard: 'bg-white/95 backdrop-blur-xl border border-emerald-700/20 shadow-xl',
    textPrimary: 'text-emerald-950',
    textSecondary: 'text-emerald-800/80',
    accentGold: '#10B981',
    borderAccent: 'border-emerald-600/30',
    cardGlow: 'shadow-[0_10px_30px_-5px_rgba(6,78,59,0.15)]',
    fontHeading: 'font-sans',
    fontBody: 'font-sans',
    ornamentStyle: 'emerald_minimal',
  },
  soft_romantic: {
    id: 'soft_romantic',
    name: 'الوردي الهادئ (Soft Romantic)',
    description: 'ألوان الباستيل الناعمة ولمسات الذهب الوردي الرقيقة',
    bgMain: 'bg-rose-50/70',
    bgCard: 'bg-white/90 backdrop-blur-xl border border-rose-200 shadow-lg',
    textPrimary: 'text-rose-950',
    textSecondary: 'text-rose-800/70',
    accentGold: '#E11D48',
    borderAccent: 'border-rose-300',
    cardGlow: 'shadow-[0_10px_30px_-5px_rgba(244,63,94,0.15)]',
    fontHeading: 'font-sans',
    fontBody: 'font-sans',
    ornamentStyle: 'floral_rose',
  },
};
