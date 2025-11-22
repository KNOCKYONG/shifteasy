'use client';

import Link from 'next/link';
import { MessageSquare, Eye, ThumbsUp, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface PostCardProps {
  post: {
    id: string;
    title: string;
    content: string;
    category: string;
    authorProfile: {
      alias: string;
      avatarColor: string;
    };
    viewCount: number;
    upvotes: number;
    commentCount: number;
    createdAt: Date;
    isPinned?: boolean;
    tags?: string[];
  };
}

export function PostCard({ post }: PostCardProps) {
  const categoryColors: Record<string, string> = {
    career: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    transition: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    advice: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
    general: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    tips: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  };

  const categoryLabels: Record<string, string> = {
    career: '커리어',
    transition: '이직',
    advice: '조언',
    general: '일반',
    tips: '팁',
  };

  return (
    <Link href={`/community/posts/${post.id}`}>
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-5 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Anonymous Avatar */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: post.authorProfile.avatarColor }}
            >
              {post.authorProfile.alias.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {post.authorProfile.alias}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(post.createdAt), {
                  addSuffix: true,
                  locale: ko,
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {post.isPinned && (
              <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium rounded">
                📌 고정
              </span>
            )}
            <span
              className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                categoryColors[post.category] || categoryColors.general
              }`}
            >
              {categoryLabels[post.category] || post.category}
            </span>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
          {post.title}
        </h3>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
          {post.content}
        </p>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {post.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <ThumbsUp className="w-3.5 h-3.5" />
            {post.upvotes}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5" />
            {post.commentCount}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            {post.viewCount}
          </span>
        </div>
      </div>
    </Link>
  );
}