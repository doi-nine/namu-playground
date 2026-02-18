import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const BookmarkContext = createContext(null);

export function BookmarkProvider({ children }) {
  const { user } = useAuth();
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [bookmarks, setBookmarks] = useState([]);

  const fetchBookmarks = useCallback(async () => {
    if (!user) {
      setBookmarkedIds(new Set());
      setBookmarks([]);
      return;
    }
    try {
      const { data } = await supabase
        .from('gathering_bookmarks')
        .select('gathering_id, gatherings(id, title)')
        .eq('user_id', user.id);

      const items = (data || [])
        .map(row => row.gatherings)
        .filter(Boolean);

      setBookmarks(items);
      setBookmarkedIds(new Set(items.map(g => g.id)));
    } catch (err) {
      console.error('즐겨찾기 조회 오류:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  const isBookmarked = useCallback((id) => bookmarkedIds.has(id), [bookmarkedIds]);

  const toggleBookmark = useCallback(async (gatheringId, title) => {
    if (!user) return;

    const alreadyBookmarked = bookmarkedIds.has(gatheringId);

    // 낙관적 업데이트
    if (alreadyBookmarked) {
      setBookmarkedIds(prev => {
        const next = new Set(prev);
        next.delete(gatheringId);
        return next;
      });
      setBookmarks(prev => prev.filter(b => b.id !== gatheringId));
    } else {
      setBookmarkedIds(prev => new Set([...prev, gatheringId]));
      setBookmarks(prev => [...prev, { id: gatheringId, title: title || '' }]);
    }

    try {
      if (alreadyBookmarked) {
        await supabase
          .from('gathering_bookmarks')
          .delete()
          .eq('user_id', user.id)
          .eq('gathering_id', gatheringId);
      } else {
        await supabase
          .from('gathering_bookmarks')
          .insert({ user_id: user.id, gathering_id: gatheringId });
      }
    } catch (err) {
      console.error('즐겨찾기 토글 오류:', err);
      // 실패 시 서버 상태로 복구
      fetchBookmarks();
    }
  }, [user, bookmarkedIds, fetchBookmarks]);

  return (
    <BookmarkContext.Provider value={{ bookmarkedIds, bookmarks, isBookmarked, toggleBookmark }}>
      {children}
    </BookmarkContext.Provider>
  );
}

export function useBookmarks() {
  const ctx = useContext(BookmarkContext);
  if (!ctx) throw new Error('useBookmarks must be used within a BookmarkProvider');
  return ctx;
}
