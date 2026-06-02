
import React from 'react';
import { WorkItem } from '../types';

interface Props {
  item: WorkItem;
}

export const WorkItemVisual: React.FC<Props> = React.memo(({ item }) => {
  const isTerminal = item.status === 'finished' || item.status === 'cancelled' || item.status === 'error';
  
  // Color based on status
  let bgColor = 'bg-slate-500';
  if (item.status === 'queued') bgColor = 'bg-amber-500';
  else if (item.status === 'processing') bgColor = 'bg-blue-500';
  else if (item.status === 'finished') bgColor = 'bg-green-500';
  else if (item.status === 'cancelled') bgColor = 'bg-slate-600'; // Dark Gray for cancelled
  else if (item.status === 'error') bgColor = 'bg-red-600'; // Red for error

  return (
    <div 
      className={`w-3 h-3 rounded-full ${bgColor} transition-all duration-300 shadow-sm`}
      style={{
        opacity: isTerminal ? 0.5 : 1,
        transform: item.status === 'processing' ? 'scale(1.1)' : 'scale(1)'
      }}
      title={`Item ${item.id} - ${item.status}`}
    />
  );
});
