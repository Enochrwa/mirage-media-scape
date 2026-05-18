import React, { useState, useEffect } from 'react';
import { Heart, MessageSquare, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { API_BASE } from '@/lib/utils';
import axios from 'axios';
import { toast } from '@/components/ui/use-toast';

interface TrackSocialBarProps {
  trackId: string;
}

const TrackSocialBar: React.FC<TrackSocialBarProps> = ({ trackId }) => {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);

  useEffect(() => {
    // In a real app we'd fetch the initial state here.
    // For now we assume 0 or fetched via tracks API if we had added those columns/joins.
  }, [trackId]);

  const handleLike = async () => {
    try {
      const res = await axios.post(`${API_BASE}/api/social/tracks/${trackId}/like`);
      setLiked(res.data.liked);
      setLikeCount(res.data.count);
    } catch (e) {
      toast({
        title: 'Auth required',
        description: 'Log in to like tracks',
        variant: 'destructive',
      });
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/track/${trackId}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copied', description: 'Share link copied to clipboard' });
  };

  return (
    <div className="mt-4 flex items-center gap-4 border-t border-zinc-800 py-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLike}
        className={liked ? 'text-red-500' : ''}
      >
        <Heart className="mr-2 h-4 w-4" fill={liked ? 'currentColor' : 'none'} />
        {likeCount > 0 && <span>{likeCount}</span>}
      </Button>
      <Button variant="ghost" size="sm">
        <MessageSquare className="mr-2 h-4 w-4" />
        {commentCount > 0 && <span>{commentCount}</span>}
      </Button>
      <Button variant="ghost" size="sm" onClick={handleShare}>
        <Share2 className="mr-2 h-4 w-4" />
      </Button>
    </div>
  );
};

export default TrackSocialBar;
