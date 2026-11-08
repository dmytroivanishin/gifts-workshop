"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Check, X, Trash2, Loader2, MessageCircleReply, MessageSquare } from "lucide-react";
import { SELECT_CHEVRON_STYLE } from "@/utils/selectChevron";
import {
  useGetAdminCommentsQuery,
  useUpdateCommentStatusMutation,
  useReplyToCommentMutation,
  useDeleteAdminCommentMutation,
} from "@/store/api";
import ConfirmModal from "@/components/shared/ConfirmModal";
import { useTranslation } from "@/i18n";
import { PopulatedComment } from "@/types";

type CommentNode = PopulatedComment & { adminReplies: PopulatedComment[] };
import { getLocalizedField } from "@/utils/localization";

export default function AdminComments() {
  const { t, locale } = useTranslation();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [comments, setComments] = useState<PopulatedComment[]>([]);

  const { data: commentsResponse, isLoading, isFetching, refetch } = useGetAdminCommentsQuery({ page, limit: 15, status: statusFilter || undefined });
  const [updateStatus, { isLoading: isUpdating }] = useUpdateCommentStatusMutation();
  const [replyToComment, { isLoading: isReplying }] = useReplyToCommentMutation();
  const [deleteComment, { isLoading: isDeleting }] = useDeleteAdminCommentMutation();

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState("");
  
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const loaderRef = useRef<HTMLDivElement | null>(null);
  const hasMore = commentsResponse?.meta?.nextPage != null;

  // Sync loaded page chunk to comments list
  useEffect(() => {
    if (commentsResponse?.data) {
      if (page === 1) {
        setComments(commentsResponse.data);
      } else {
        setComments((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const newComments = commentsResponse.data.filter((c) => !existingIds.has(c.id));
          return [...prev, ...newComments];
        });
      }
    }
  }, [commentsResponse, page]);

  // IntersectionObserver bottom anchor logic
  useEffect(() => {
    if (!hasMore || isFetching || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    const currentLoader = loaderRef.current;
    if (currentLoader) {
      observer.observe(currentLoader);
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader);
      }
    };
  }, [hasMore, isFetching, isLoading]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const handleStatusChange = async (id: string, newStatus: "Approved" | "Rejected") => {
    try {
      await updateStatus({ id, status: newStatus }).unwrap();
      // Refetch or update local state
      setComments(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  const handleReplySubmit = async (id: string) => {
    if (!replyText.trim()) return;
    try {
      await replyToComment({ id, text: replyText.trim() }).unwrap();
      setReplyingToId(null);
      setReplyText("");
      setPage(1);
      refetch();
    } catch (error) {
      console.error("Failed to submit reply", error);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteComment(deleteTargetId).unwrap();
      setIsDeleteOpen(false);
      setDeleteTargetId("");
      setPage(1);
      refetch();
    } catch (err) {
      console.error("Failed to delete comment", err);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Approved": return "bg-[#7D8945]/20 text-[#5C6535] border-[#7D8945]/30"; // Lime
      case "Rejected": return "bg-[#B87070]/20 text-[#8F4A4A] border-[#B87070]/30"; // Rose
      case "Review": default: return "bg-[#FA943B]/20 text-[#904504] border-[#FA943B]/30"; // Orange
    }
  };

  const sortedComments = useMemo(() => {
    const parentMap = new Map<string, CommentNode>();
    const orphans: PopulatedComment[] = [];
    
    // Find all parents
    comments.forEach(c => {
      if (!c.replyId) {
        parentMap.set(c.id, { ...c, adminReplies: [] });
      }
    });

    // Assign replies
    comments.forEach(c => {
      if (c.replyId) {
        if (parentMap.has(c.replyId)) {
          parentMap.get(c.replyId)!.adminReplies.push(c);
        } else {
          orphans.push(c);
        }
      }
    });

    // Sort replies ASC (oldest first under parent)
    parentMap.forEach(parent => {
      parent.adminReplies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

    const parents = Array.from(parentMap.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return parents;
  }, [comments]);

  const statusLabel = (status: string): string => {
    if (status === "Approved") return t("comment_status_approved");
    if (status === "Rejected") return t("comment_status_rejected");
    return t("comment_status_review");
  };

  const renderCommentNode = (comment: PopulatedComment, isReply: boolean = false) => (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
      <div className="flex flex-col gap-1.5 flex-1 relative z-10">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-foreground">{comment.name}</span>
          {isReply && (
            <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-wider rounded-full border border-primary/20">
              {t("admin")}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{new Date(comment.createdAt).toLocaleString()}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadgeColor(comment.status)}`}>
            {statusLabel(comment.status)}
          </span>
        </div>
        <p className="text-sm text-foreground whitespace-pre-wrap">{comment.text}</p>
        {!isReply && comment.post && (
          <p className="text-xs text-muted-foreground mt-1">
            {t("on_post")} <span className="font-medium text-primary">{getLocalizedField(comment.post.title, locale) || comment.post.slug}</span>
          </p>
        )}
      </div>
      
      <div className="flex items-center gap-1.5 self-end sm:self-auto flex-shrink-0 relative z-10">
        {comment.status !== "Approved" && (
          <button
            onClick={() => handleStatusChange(comment.id, "Approved")}
            disabled={isUpdating}
            className="p-1.5 rounded-md hover:bg-[#7D8945]/10 text-muted-foreground hover:text-[#5C6535] transition-colors cursor-pointer"
            title={t("approve")}
          >
            <Check size={16} />
          </button>
        )}
        {comment.status !== "Rejected" && (
          <button
            onClick={() => handleStatusChange(comment.id, "Rejected")}
            disabled={isUpdating}
            className="p-1.5 rounded-md hover:bg-[#B87070]/10 text-muted-foreground hover:text-[#8F4A4A] transition-colors cursor-pointer"
            title={t("reject")}
          >
            <X size={16} />
          </button>
        )}
        {!isReply && (
          <button
            onClick={() => setReplyingToId(replyingToId === comment.id ? null : comment.id)}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${replyingToId === comment.id ? "bg-primary text-primary-foreground" : "hover:bg-muted text-subtle-foreground hover:text-foreground"}`}
            title={t("reply")}
          >
            <MessageCircleReply size={16} />
          </button>
        )}
        <button
          onClick={() => handleDeleteClick(comment.id)}
          disabled={isDeleting}
          className="p-1.5 rounded-md hover:bg-muted hover:text-destructive transition-colors text-subtle-foreground cursor-pointer"
          title={t("delete")}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("comments") || "Comments"}</h1>
          <p className="text-sm text-muted-foreground">
            {t("comments_subtitle") || "Manage user comments and replies."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={SELECT_CHEVRON_STYLE}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          >
            <option value="">{t("all_statuses") || "All Statuses"}</option>
            <option value="Review">{t("comment_status_review")}</option>
            <option value="Approved">{t("comment_status_approved")}</option>
            <option value="Rejected">{t("comment_status_rejected")}</option>
          </select>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/40 overflow-hidden shadow-sm">
        <div className="divide-y divide-border/45">
          {isLoading && page === 1 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Loader2 className="animate-spin inline mr-2" size={16} />
              {t("loading") || "Loading..."}
            </div>
          ) : sortedComments.length > 0 ? (
            sortedComments.map((parent) => (
              <div key={parent.id} className="flex flex-col divide-y divide-border/20 border-b border-border/45 last:border-b-0">
                <div className="p-4 hover:bg-muted/10 transition-colors">
                  {renderCommentNode(parent, false)}
                  
                  {replyingToId === parent.id && (
                    <div className="mt-4 pl-4 border-l-2 border-border/50 flex flex-col gap-2 relative z-10">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={t("placeholder_reply")}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all min-h-[80px] resize-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setReplyingToId(null);
                            setReplyText("");
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-subtle-foreground hover:text-foreground bg-secondary hover:bg-muted border border-border rounded-lg transition-colors cursor-pointer"
                        >
                          {t("cancel")}
                        </button>
                        <button
                          onClick={() => handleReplySubmit(parent.id)}
                          disabled={!replyText.trim() || isReplying}
                          className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 rounded-lg transition-opacity disabled:opacity-50 cursor-pointer"
                        >
                          {isReplying ? t("sending") : t("send_reply")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {parent.adminReplies && parent.adminReplies.length > 0 && (
                  <div className="bg-black/5 divide-y divide-border/20">
                    {parent.adminReplies.map((reply) => (
                      <div key={reply.id} className="p-4 pl-12 relative hover:bg-muted/10 transition-colors">
                        <div className="absolute left-6 top-0 w-4 h-8 border-l-2 border-b-2 border-border/60 rounded-bl-xl z-0"></div>
                        {renderCommentNode(reply, true)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))


          ) : (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <div className="bg-muted/50 p-4 rounded-full mb-3">
                <MessageSquare className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">{t("no_comments")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("comments_empty_hint")}</p>
            </div>
          )}
          
          {comments.length > 0 && hasMore && (
            <div ref={loaderRef} className="p-4 flex items-center justify-center text-sm text-muted-foreground border-t border-border/45 bg-muted/5">
              <Loader2 className="animate-spin mr-2 animate-duration-1000" size={16} />
              {t("loading") || "Loading..."}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteOpen}
        title={t("delete_comment")}
        message={t("delete_confirm_comment")}
        confirmText={t("delete")}
        cancelText={t("cancel")}
        onConfirm={handleConfirmDelete}
        onClose={() => setIsDeleteOpen(false)}
        isLoading={isDeleting}
      />
    </div>
  );
}
