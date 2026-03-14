import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../../shared/lib/firebase';
import { useLessonStore } from '../../stores/useLessonStore';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { Trash2, Globe, Lock, Play, Layers } from 'lucide-react';


export function DecksScreen() {
    const [myDecks, setMyDecks] = useState<any[]>([]);
    const [communityDecks, setCommunityDecks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
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
            
            // Fetch Community Decks
            const publicQuery = query(
                collection(db, 'decks'),
                where('isPublic', '==', true),
                limit(20)
            );
            const publicSnapshot = await getDocs(publicQuery);
            const publicData = publicSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            
            setCommunityDecks(publicData);

            // Fetch My Decks
            if (user) {
                const myQuery = query(
                    collection(db, 'decks'),
                    where('creatorId', '==', user.uid)
                );
                const mySnapshot = await getDocs(myQuery);
                const myData = mySnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
                setMyDecks(myData);
            }
        } catch (error) {
            console.error("Error fetching decks:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePlay = (deck: any) => {
        // Assume deck.path is array of {word, description} or similar
        // useLessonStore.initializeLesson expects lessonId and path
        useLessonStore.getState().resetLesson();
        initializeLesson(deck.id, deck.path);
        navigate(`/lesson/${deck.id}`);
    };

    const togglePublicStatus = async (deckId: string, currentStatus: boolean) => {
        try {
            setMyDecks(prev => prev.map(d => d.id === deckId ? { ...d, isPublic: !currentStatus } : d));
            await updateDoc(doc(db, 'decks', deckId), { isPublic: !currentStatus });
            // Re-fetch community decks to update the feed immediately
            fetchDecks();
        } catch (error) {
            console.error("Failed to toggle status:", error);
        }
    };

    const handleDelete = async (deckId: string) => {
        if (!window.confirm("Are you sure you want to delete this deck?")) return;
        try {
            setMyDecks(prev => prev.filter(d => d.id !== deckId));
            setCommunityDecks(prev => prev.filter(d => d.id !== deckId));
            await deleteDoc(doc(db, 'decks', deckId));
        } catch (error) {
            console.error("Failed to delete deck:", error);
        }
    };

    const DeckCard = ({ deck, isMine }: { deck: any, isMine: boolean }) => (
        <Card className="bg-card/40 backdrop-blur-xl border border-white/10 mb-4 overflow-hidden relative group transition-all hover:scale-[1.02]">
            <div className="p-4 flex flex-col space-y-3">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-lg font-bold text-white capitalize">{deck.title || deck.id.replace(/_/g, ' ')}</h3>
                        {deck.prompt && <p className="text-xs text-muted-foreground italic mb-1">"{deck.prompt}"</p>}
                    </div>
                </div>
                
                <div className="flex flex-wrap gap-1 mt-2">
                    {deck.path?.map((wordObj: any, idx: number) => (
                        <span key={idx} className="text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white/80 px-2 py-1 rounded">
                            {wordObj.word}
                        </span>
                    ))}
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                    <Button onClick={() => handlePlay(deck)} className="h-8 rounded-full shadow-lg shadow-primary/20 px-6 font-bold uppercase tracking-wider text-xs">
                        <Play className="w-4 h-4 mr-1.5" /> Play
                    </Button>

                    {isMine && (
                        <div className="flex space-x-2">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => togglePublicStatus(deck.id, deck.isPublic)}
                                className={`rounded-full h-8 px-3 text-xs ${deck.isPublic ? 'text-green-400 bg-green-400/10 hover:bg-green-400/20' : 'text-muted-foreground hover:bg-white/5'}`}
                            >
                                {deck.isPublic ? <><Globe className="w-3 h-3 mr-1" /> Public</> : <><Lock className="w-3 h-3 mr-1" /> Private</>}
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDelete(deck.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-full h-8 w-8"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );

    return (
        <div className="relative z-20 pb-20 animate-in fade-in duration-500">
            <div className="px-4 pt-6 pb-2">
                <div className="flex items-center space-x-2 mb-6">
                    <Layers className="w-6 h-6 text-primary" />
                    <h1 className="text-2xl font-black tracking-tight text-white uppercase">Dynamic Decks</h1>
                </div>

                {isLoading ? (
                    <div className="w-full py-12 flex justify-center text-muted-foreground">
                        Loading decks...
                    </div>
                ) : (
                    <>
                        {/* My Decks Section */}
                        <div className="mb-8">
                            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center">
                                <span className="bg-primary/20 text-primary w-6 h-6 rounded-full flex items-center justify-center mr-2">{myDecks.length}</span>
                                My Decks
                            </h2>
                            {myDecks.length === 0 ? (
                                <div className="text-sm text-center py-6 text-muted-foreground bg-white/5 rounded-2xl border border-white/5 border-dashed">
                                    You haven't generated any decks yet.<br/>Go to the map and use the magic wand!
                                </div>
                            ) : (
                                myDecks.map(deck => <DeckCard key={deck.id} deck={deck} isMine={true} />)
                            )}
                        </div>

                        {/* Community Decks Section */}
                        <div>
                            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center">
                                <Globe className="w-4 h-4 mr-2" />
                                Community Decks
                            </h2>
                            {communityDecks.filter(d => !myDecks.find(md => md.id === d.id)).length === 0 ? (
                                <div className="text-sm text-center py-6 text-muted-foreground bg-white/5 rounded-2xl border border-white/5 border-dashed">
                                    No public decks available.
                                </div>
                            ) : (
                                communityDecks
                                    .filter(d => !myDecks.find(md => md.id === d.id)) // don't show owned decks twice
                                    .map(deck => <DeckCard key={deck.id} deck={deck} isMine={auth.currentUser?.uid === deck.creatorId} />)
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
