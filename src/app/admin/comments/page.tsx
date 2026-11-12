"use client";

import { cn } from "@/utils/cn";
import { RowAction, RowActions } from "@/components/shared/RowAction";
import { useState, useEffect, useRef, useMemo } from "react";
import { Check, X, Trash2, Loader2, MessageCircleReply, MessageSquare } from "lucide-react";
import {
  useGetAdminCommentsQuery,
  useUpdateCommentStatusMutation,
  useReplyToCommentMutation,
  useDeleteAdminCommentMutation,
} from "@/store/api";
import ConfirmModal from "@/components/shared/ConfirmModal";
import Combobox from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/i18n";
import { PopulatedComment } from "@/types";

type CommentNode = PopulatedComment & { adminReplies: PopulatedComment[] };
import { getLocalizedField } from "@/utils/localization";
import { BUTTON_M_SIZE } from "@/utils/designTokens";

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
          const existingIds = new Set(prev.map((comment) => comment.id));
          const newComments = commentsResponse.data.filter((comment) => !existingIds.has(comment.id));
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
      setComments(prev => prev.map(comment => comment.id === id ? { ...comment, status: newStatus } : comment));
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
    } catch (error) {
      console.error("Failed to delete comment", error);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Approved": return "bg-[#7D8945]/20 text-lime-text border-[#7D8945]/30"; // Lime
      case "Rejected": return "bg-[#B87070]/20 text-[#8F4A4A] border-[#B87070]/30"; // Rose
      case "Review": default: return "bg-[#FA943B]/20 text-[#904504] border-[#FA943B]/30"; // Orange
    }
  };

  const sortedComments = useMemo(() => {
    const parentMap = new Map<string, CommentNode>();
    const orphans: PopulatedComment[] = [];
    
    // Find all parents
    comments.forEach(comment => {
      if (!comment.replyId) {
        parentMap.set(comment.id, { ...comment, adminReplies: [] });
      }
    });

    // Assign replies
    comments.forEach(comment => {
      if (comment.replyId) {
        if (parentMap.has(comment.replyId)) {
          parentMap.get(comment.replyId)!.adminReplies.push(comment);
        } else {
          orphans.push(comment);
        }
      }
    });

    // Sort replies ASC (oldest first under parent)
    parentMap.forEach(parent => {
      parent.adminReplies.sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime());
    });

    const parents = Array.from(parentMap.values()).sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());

    return parents;
  }, [comments]);

  const statusLabel = (status: string): string => {
    if (status === "Approved") return t("comment_status_approved");
    if (status === "Rejected") return t("comment_status_rejected");
    return t("comment_status_review");
  };

  const renderCommentNode = (comment: PopulatedComment, isReply: boolean = false) => (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
      <div className="flex flex-col gap-1.5 flex-1 min-w-0 relative z-10">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[13px] sm:text-sm text-foreground">{comment.name}</span>
          {isReply && (
            <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wider rounded-full border border-primary/20">
              {t("admin")}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{new Date(comment.createdAt).toLocaleString()}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadgeColor(comment.status)}`}>
            {statusLabel(comment.status)}
          </span>
        </div>
        <p className="text-sm text-foreground whitespace-pre-wrap break-words">{comment.text}</p>
        {!isReply && comment.post && (
          <p className="text-xs text-muted-foreground mt-1">
            {t("on_post")} <span className="font-medium text-primary">{getLocalizedField(comment.post.title, locale) || comment.post.slug}</span>
          </p>
        )}
      </div>
      
      <div className="relative z-10">
        <RowActions>
          {comment.status !== "Approved" && (
            <RowAction icon={Check} tone="success" title={t("approve")} disabled={isUpdating} onClick={() => handleStatusChange(comment.id, "Approved")} />
          )}
          {comment.status !== "Rejected" && (
            <RowAction icon={X} tone="danger" title={t("reject")} disabled={isUpdating} onClick={() => handleStatusChange(comment.id, "Rejected")} />
          )}
          {!isReply && (
            <RowAction icon={MessageCircleReply} title={t("reply")} active={replyingToId === comment.id} onClick={() => setReplyingToId(replyingToId === comment.id ? null : comment.id)} />
          )}
          <RowAction icon={Trash2} tone="destructive" title={t("delete")} disabled={isDeleting} onClick={() => handleDeleteClick(comment.id)} />
        </RowActions>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-[22px] lg:text-2xl font-bold tracking-tight text-foreground">{t("comments") || "Comments"}</h1>
          <p className="text-xs text-muted-foreground">
            {t("comments_subtitle") || "Manage user comments and replies."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Combobox
            className="w-52"
            options={[
              { value: "Review", label: t("comment_status_review") },
              { value: "Approved", label: t("comment_status_approved") },
              { value: "Rejected", label: t("comment_status_rejected") },
            ]}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as string)}
            placeholder={t("all_statuses") || "All Statuses"}
            searchable={false}
          />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="divide-y divide-border/45">
          {isLoading && page === 1 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <Loader2 className="animate-spin inline mr-2" size={16} />
              {t("loading") || "Loading..."}
            </div>
          ) : sortedComments.length > 0 ? (
            sortedComments.map((parent) => (
              <div key={parent.id} className="flex flex-col divide-y divide-border/20 border-b border-border last:border-b-0">
                <div className="p-4 hover:bg-muted/10 transition-colors">
                  {renderCommentNode(parent, false)}
                  
                  {replyingToId === parent.id && (
                    <div className="mt-4 pl-4 border-l-2 border-border/50 flex flex-col gap-2 relative z-10">
                      <Textarea
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        placeholder={t("placeholder_reply")}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setReplyingToId(null);
                            setReplyText("");
                          }}
                          className={cn(BUTTON_M_SIZE, "font-medium text-subtle-foreground hover:text-foreground bg-secondary hover:bg-muted border border-border rounded-lg transition-colors cursor-pointer")}
                        >
                          {t("cancel")}
                        </button>
                        <button
                          onClick={() => handleReplySubmit(parent.id)}
                          disabled={!replyText.trim() || isReplying}
                          className={cn(BUTTON_M_SIZE, "font-medium bg-primary text-primary-foreground hover:opacity-90 rounded-lg transition-opacity disabled:opacity-50 cursor-pointer")}
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
                        <div className="absolute left-6 top-0 w-4 h-8 border-l-2 border-b-2 border-border rounded-bl-xl z-0"></div>
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
              <p className="text-sm font-semibold text-foreground">{t("no_comments")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("comments_empty_hint")}</p>
            </div>
          )}
          
          {comments.length > 0 && hasMore && (
            <div ref={loaderRef} className="p-4 flex items-center justify-center text-xs text-muted-foreground border-t border-border bg-muted/5">
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
