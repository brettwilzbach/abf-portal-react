'use client';

import { useState, useEffect } from 'react';
import { StickyNote, Save, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface NotePadProps {
  storageKey: string;
  title?: string;
}

export function NotePad({
  storageKey,
  title = "Highlight Bain Positions/PM Feedback & Views/Summarized Viewpoints from IC"
}: NotePadProps) {
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Load notes from localStorage on mount
  useEffect(() => {
    const savedNotes = localStorage.getItem(storageKey);
    if (savedNotes) {
      try {
        const parsed = JSON.parse(savedNotes);
        setNotes(parsed.content || '');
        setLastSaved(parsed.timestamp || null);
      } catch {
        setNotes(savedNotes);
      }
    }
  }, [storageKey]);

  const handleSave = () => {
    const timestamp = new Date().toLocaleString();
    const data = {
      content: notes,
      timestamp,
    };
    localStorage.setItem(storageKey, JSON.stringify(data));
    setLastSaved(timestamp);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Auto-save on blur
  const handleBlur = () => {
    if (notes.trim()) {
      handleSave();
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <StickyNote className="h-4 w-4" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {lastSaved && (
              <span className="text-xs text-gray-400">
                Last saved: {lastSaved}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              className="h-8 gap-1"
            >
              {saved ? (
                <>
                  <Check className="h-3 w-3 text-green-600" />
                  <span className="text-green-600 text-xs">Saved</span>
                </>
              ) : (
                <>
                  <Save className="h-3 w-3" />
                  <span className="text-xs">Save</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleBlur}
          placeholder="Add notes on Bain positions, PM feedback, IC viewpoints..."
          className="w-full h-32 p-3 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent"
        />
      </CardContent>
    </Card>
  );
}
