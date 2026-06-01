import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number, decimals = 1): string {
  if (num >= 100000) return `${(num / 100000).toFixed(decimals)}L`;
  if (num >= 1000) return `${(num / 1000).toFixed(decimals)}K`;
  return num.toFixed(decimals);
}

export function formatCurrency(num: number): string {
  return `₹${formatNumber(num)}`;
}

export function getScoreColor(score: number): string {
  if (score >= 90) return '#d4a853';
  if (score >= 80) return '#10b981';
  if (score >= 70) return '#0c7b93';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return 'Rare Opportunity';
  if (score >= 80) return 'Strong Candidate';
  if (score >= 70) return 'Watchlist';
  if (score >= 60) return 'Speculative';
  return 'Avoid';
}

export function getScoreClass(score: number): string {
  if (score >= 90) return 'score-rare';
  if (score >= 80) return 'score-strong';
  if (score >= 70) return 'score-watchlist';
  return '';
}

export function getChangeColor(change: number): string {
  if (change > 0) return '#10b981';
  if (change < 0) return '#ef4444';
  return '#6b7280';
}

export function getRiskColor(level: string): string {
  switch (level) {
    case 'Low': return '#10b981';
    case 'Medium': return '#f59e0b';
    case 'High': return '#ef4444';
    default: return '#6b7280';
  }
}
