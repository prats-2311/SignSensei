import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../../shared/lib/firebase';
import { useLessonStore } from '../../stores/useLessonStore';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../shared/ui/Button';
import { GlassCard } from '../../shared/ui/GlassCard';
import { SkeletonCard } from '../../shared/ui/Skeleton';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog';
import { Trash2, Globe, Lock, Play, Layers } from 'lucide-react';

export function DecksScreen() {
  const [myDecks, setMyDecks] = useState<any[]>([]);
  const [communityDecks, setCommunityDecks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingDeckId, setDeletingDeckId] = useState<string | null>(null);
  const { initializeLesson } = useLessonStore();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      fetchDecks(user);
    });
    return () => unsubscribe();
  }, []);

  const fetchDecks = async (user: any = auth.currentUser) => {
    setIsLoading(true);
    try {
      const publicQuery = query(
        collection(db, 'decks'),
        where('isPublic', '==', true),
        limit(20)
      );
      const publicSnapshot = await getDocs(publicQuery);
      const publicData = publicSnapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setCommunityDecks(publicData);

      if (user) {
        const myQuery = query(collection(db, 'decks'), where('creatorId', '==', user.uid));
        const mySnapshot = await getDocs(myQuery);
        const myData = mySnapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setMyDecks(myData);
      }
    } catch (error) {
      console.error('Error fetching decks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlay = (deck: any) => {
    useLessonStore.getState().resetLesson();
    initializeLesson(deck.id, deck.path);
    navigate(`/lesson/${deck.id}`);
  };

  const togglePublicStatus = async (deckId: string, currentStatus: boolean) => {
    try {
      setMyDecks(prev => prev.map(d => d.id === deckId ? { ...d, isPublic: !currentStatus } : d));
      await updateDoc(doc(db, 'decks', deckId), { isPublic: !currentStatus });
      fetchDecks();
    } catch (error) {
      console.error('Failed to toggle status:', error);
    }
  };

  const handleDelete = async (deckId: string) => {
    try {
      setMyDecks(prev => prev.filter(d => d.id !== deckId));
      setCommunityDecks(prev => prev.filter(d => d.id !== deckId));
      await deleteDoc(doc(db, 'decks', deckId));
    } catch (error) {
      console.error('Failed to delete deck:', error);
    }
  };

  return (
    <div className="relative z-20 pb-20 animate-in fade-in duration-500">
      <div className="px-4 pt-6 pb-2">
        <div className="flex items-center space-x-2 mb-6">
          <Layers className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">Dynamic Decks</h1>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <>
            {/* My Decks Section */}
            <div className="mb-8">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center">
                <span className="bg-primary/20 text-primary w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs">
                  {myDecks.length}
                </span>
                My Decks
              </h2>
              {myDecks.length === 0 ? (
                <GlassCard className="py-10 flex flex-col items-center gap-3 text-center border-dashed">
                  <span className="text-4xl">🤟</span>
                  <p className="text-sm text-muted-foreground">
                    No decks yet.<br />
                    Use the wand on the map to generate one!
                  </p>
                </GlassCard>
              ) : (
                <div className="space-y-4">
                  {myDecks.map(deck => (
                    <DeckCard
                      key={deck.id}
                      deck={deck}
                      isMine={true}
                      onPlay={handlePlay}
                      onTogglePublic={togglePublicStatus}
                      onDelete={(id) => setDeletingDeckId(id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Community Decks Section */}
            <div>
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Community Decks
              </h2>
              {communityDecks.filter(d => !myDecks.find(md => md.id === d.id)).length === 0 ? (
                <GlassCard className="py-10 flex flex-col items-center gap-3 text-center border-dashed">
                  <Globe className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    No community decks yet.<br />
                    Be the first to share one!
                  </p>
                </GlassCard>
              ) : (
                <div className="space-y-4">
                  {communityDecks
                    .filter(d => !myDecks.find(md => md.id === d.id))
                    .map(deck => (
                      <DeckCard
                        key={deck.id}
                        deck={deck}
                        isMine={auth.currentUser?.uid === deck.creatorId}
                        onPlay={handlePlay}
                        onTogglePublic={togglePublicStatus}
                        onDelete={(id) => setDeletingDeckId(id)}
                      />
                    ))
                  }
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deletingDeckId !== null}
        onClose={() => setDeletingDeckId(null)}
        onConfirm={() => deletingDeckId && handleDelete(deletingDeckId)}
        title="Delete Deck"
        message="Are you sure you want to delete this deck? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
      />
    </div>
  );
}

/* Extracted DeckCard — no longer an inner component (fixes re-render bug) */
function DeckCard({
  deck,
  isMine,
  onPlay,
  onTogglePublic,
  onDelete,
}: {
  deck: any;
  isMine: boolean;
  onPlay: (deck: any) => void;
  onTogglePublic: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <GlassCard variant="elevated" className="overflow-hidden">
      {/* Accent line */}
      <div className="h-0.5 w-full bg-gradient-to-r from-primary/60 via-secondary/60 to-transparent" />

      <div className="p-5 flex flex-col gap-3">
        <div>
          <h3 className="text-base font-bold text-white capitalize leading-tight">
            {deck.title || deck.id.replace(/_/g, ' ')}
          </h3>
          {deck.prompt && (
            <p className="text-xs text-muted-foreground italic mt-0.5">"{deck.prompt}"</p>
          )}
        </div>

        {/* Word tags */}
        <div className="flex flex-wrap gap-1.5">
          {deck.path?.map((wordObj: any, idx: number) => (
            <span
              key={idx}
              className="text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary/80 border border-primary/20 px-2.5 py-1 rounded-full"
            >
              {wordObj.word}
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <Button
            onClick={() => onPlay(deck)}
            className="h-10 rounded-2xl shadow-lg shadow-primary/20 px-5 font-bold uppercase tracking-wider text-xs"
          >
            <Play className="w-3.5 h-3.5 mr-1.5" />
            Play
          </Button>

          {isMine && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onTogglePublic(deck.id, deck.isPublic)}
                aria-label={deck.isPublic ? 'Make private' : 'Make public'}
                className={`rounded-2xl h-9 px-3 text-xs ${
                  deck.isPublic
                    ? 'text-green-400 bg-green-400/10 hover:bg-green-400/20'
                    : 'text-muted-foreground hover:bg-white/5'
                }`}
              >
                {deck.isPublic
                  ? <><Globe className="w-3 h-3 mr-1" />Public</>
                  : <><Lock className="w-3 h-3 mr-1" />Private</>
                }
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(deck.id)}
                aria-label="Delete deck"
                className="text-red-400/70 hover:text-red-400 hover:bg-red-400/10 rounded-2xl h-9 w-9"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
