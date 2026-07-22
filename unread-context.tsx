import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/client/supabase';
import { useSession } from '@/ctx';

interface UnreadCounts {
  notifCount: number;
  msgCount: number;
  totalCount: number;
}

interface UnreadContextType extends UnreadCounts {
  refresh: () => void;
  resetNotif: () => void;
  resetMsg: () => void;
}

const UnreadContext = createContext<UnreadContextType>({
  notifCount: 0,
  msgCount: 0,
  totalCount: 0,
  refresh: () => {},
  resetNotif: () => {},
  resetMsg: () => {},
});

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const userId = session?.user?.id ?? '';
  const [notifCount, setNotifCount] = useState(0);
  const [msgCount, setMsgCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchCounts = useCallback(async () => {
    if (!userId) { setNotifCount(0); setMsgCount(0); return; }
    const { data } = await supabase.rpc('get_unread_counts', { uid: userId });
    if (data) {
      setNotifCount(Number(data.notifications ?? 0));
      setMsgCount(Number(data.messages ?? 0));
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchCounts();

    // Subscrição em tempo real a novas notificações e mensagens
    const ch = supabase
      .channel(`unread-${userId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => setNotifCount((n) => n + 1)
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => fetchCounts()
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        // O RPC get_unread_counts já filtra por utilizador — apenas refrescamos se
        // a mensagem não foi enviada pelo próprio utilizador
        (payload) => {
          const msg = payload.new as { sender_id?: string };
          if (msg.sender_id !== userId) fetchCounts();
        }
      )
      .subscribe();

    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [userId, fetchCounts]);

  const resetNotif = () => setNotifCount(0);
  const resetMsg = () => setMsgCount(0);

  return (
    <UnreadContext.Provider value={{
      notifCount, msgCount,
      totalCount: notifCount + msgCount,
      refresh: fetchCounts,
      resetNotif, resetMsg,
    }}>
      {children}
    </UnreadContext.Provider>
  );
}

export const useUnread = () => useContext(UnreadContext);
