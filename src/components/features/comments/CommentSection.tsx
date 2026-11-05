"use client";

import { useState, useEffect } from "react";
import { useGetPublicCommentsQuery, useCreatePublicCommentMutation } from "@/store/api";
import { useTranslation } from "@/i18n";
import { Loader2, Send } from "lucide-react";

export function CommentSection({ postId }: { postId: string }) {
  const { t } = useTranslation();
  const { data: commentsResponse, isLoading, refetch } = useGetPublicCommentsQuery({ postId });
  const [createComment, { isLoading: isSubmitting }] = useCreatePublicCommentMutation();

  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [isNameSaved, setIsNameSaved] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const savedName = localStorage.getItem("commenter_name");
    if (savedName) {
      setName(savedName);
      setIsNameSaved(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !text.trim()) {
      setErrorMsg("Please fill in all fields.");
      return;
    }

    try {
      setErrorMsg("");
      await createComment({ postId, name: name.trim(), text: text.trim() }).unwrap();
      
      localStorage.setItem("commenter_name", name.trim());
      setIsNameSaved(true);
      setText("");
      setSubmitSuccess(true);
      
      setTimeout(() => setSubmitSuccess(false), 5000);
      refetch();
    } catch (err) {
      console.error("Failed to post comment", err);
      setErrorMsg("Failed to post comment. Please try again.");
    }
  };

  const comments = commentsResponse?.data || [];
  
  // Group replies
  const topLevelComments = comments.filter((c) => !c.replyId);
  const getReplies = (parentId: string) => comments.filter((c) => c.replyId === parentId);

  return (
    <div className="mt-12 pt-8 border-t border-border/40 font-sans max-w-3xl mx-auto">
      <h3 className="text-xl font-bold text-foreground mb-6">{t("comments") || "Comments"}</h3>

      <form onSubmit={handleSubmit} className="mb-10 space-y-4 bg-secondary/30 p-6 rounded-2xl border border-border/50">
        <h4 className="font-semibold text-sm text-foreground mb-2">{t("leave_comment") || "Leave a comment"}</h4>
        
        {!isNameSaved && (
          <div className="space-y-1.5">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("your_name") || "Your name"}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              disabled={isSubmitting}
            />
          </div>
        )}
        
        {isNameSaved && (
          <div className="flex items-center justify-between text-sm text-muted-foreground bg-background/50 px-4 py-2 rounded-lg border border-border/50">
            <span>{t("commenting_as") || "Commenting as"} <strong className="text-foreground">{name}</strong></span>
            <button 
              type="button" 
              onClick={() => {
                localStorage.removeItem("commenter_name");
                setIsNameSaved(false);
                setName("");
              }}
              className="text-xs hover:text-primary transition-colors underline underline-offset-2 cursor-pointer"
            >
              {t("change") || "Change"}
            </button>
          </div>
        )}

        <div className="space-y-1.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("write_comment") || "Write your comment here..."}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all min-h-[100px] resize-y"
            disabled={isSubmitting}
          />
        </div>

        {errorMsg && <p className="text-destructive text-sm font-medium">{errorMsg}</p>}
        {submitSuccess && (
          <p className="text-[#5C6535] bg-[#7D8945]/10 px-4 py-2 rounded-lg text-sm font-medium border border-[#7D8945]/20">
            {t("comment_submitted") || "Your comment has been submitted and is awaiting moderation."}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !text.trim() || (!isNameSaved && !name.trim())}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#835952] text-white font-semibold rounded-xl hover:bg-[#674742] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            {t("post_comment") || "Post Comment"}
          </button>
        </div>
      </form>

      <div className="space-y-6">
        {isLoading ? (
          <div className="py-8 flex justify-center text-muted-foreground">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : topLevelComments.length > 0 ? (
          topLevelComments.map((comment) => (
            <div key={comment.id} className="flex flex-col gap-3">
              {/* Parent Comment */}
              <div className="bg-card p-5 rounded-2xl border border-border/40 shadow-sm flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">{comment.name}</span>
                  <span className="text-xs text-muted-foreground">{new Date(comment.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{comment.text}</p>
              </div>

              {/* Replies */}
              {getReplies(comment.id).map((reply) => (
                <div key={reply.id} className="ml-8 md:ml-12 relative flex gap-3">
                  {/* Decorative curved line for reply tree */}
                  <div className="absolute -left-6 md:-left-8 top-0 w-4 h-8 border-l-2 border-b-2 border-border/60 rounded-bl-xl"></div>
                  
                  <div className="bg-secondary/40 p-4 rounded-2xl border border-border/30 w-full flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{t("admin") || "Admin"}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{new Date(reply.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{reply.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="py-10 text-center bg-secondary/20 rounded-2xl border border-border/30 border-dashed">
            <p className="text-sm font-medium text-muted-foreground">{t("no_comments_yet") || "No comments yet. Be the first to share your thoughts!"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
