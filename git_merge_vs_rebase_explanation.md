# Git Merge vs. Git Rebase: A Practical Guide

This document explains the concepts of `git merge` and `git rebase`, specifically focusing on how we resolved the conflict when initializing the SignSensei repository.

## The Problem: Divergent Histories
When we created the project repository on GitLab, a default `README.md` was automatically generated on the remote `main` branch. 
Meanwhile, locally, we generated a massive frontend codebase and our own custom `readme.md`. 
When we tried to push (`git push`), Git blocked us because our local history didn't contain that initial GitLab commit.

## The Conflict
We pulled the remote changes to sync our local branch. Because both histories added a file with the same name (`readme.md` vs `README.md`, which macOS treats identically), Git didn't know which one to keep, resulting in a **Merge Conflict**.

We manually resolved this by keeping our custom documentation and removing the Git conflict markers, then running `git add README.md`.

---

## Combining Histories: Merge vs. Rebase

When integrating remote changes into your local branch, you have two primary options: Merge or Rebase.

### 1. Git Merge (`git pull origin main`)
Merging creates a parallel timeline that eventually converges. It brings down the remote commits, leaves your local commits as they are, and creates a brand new "Merge Commit" to tie them together.

**Visualizing a Merge:**
```text
(Remote):  A ---> B (Default GitLab README)
                   \
                    \--> M (Merge Commit - "Conflict resolved!")
                    /
(Local):   A ---> C (Our Frontend code)
```

*   **Pros:** Perfectly preserves the exact chronology of all commits.
*   **Cons:** The Git history becomes a messy graph with many forks and merge commits.

### 2. Git Rebase (`git pull origin main --rebase`)
Rebasing rewrites history to create a clean, linear progression. It temporarily "sets aside" your local commits, downloads the remote commits, and then replays your local commits *on top* of the new remote history.

**Visualizing a Rebase (What we did):**
```text
(Remote):  A ---> B (Default GitLab README)
                             \
(Local):                      \---> C' (Our Frontend code, reapplied)
```

*   **Pros:** Results in a beautiful, easy-to-read, straight-line history. It looks as if you waited for the remote changes before you even started your work.
*   **Cons:** It technically rewrites commit history (creating a new `C'` commit). You should never rebase commits that you have already shared/pushed to a public branch that others rely on.

### Summary of Commands Used
To resolve our specific conflict using Rebase:
1.  `git pull origin main --rebase` (Initiate rebase, triggering the conflict)
2.  *Manually edited `README.md` in the editor to resolve the text conflict.*
3.  `git add README.md` (Stage the resolved file)
4.  `git rebase --continue` (Finish replaying the rest of our local commits)
5.  `git push origin main` (Successfully push the linear history to GitLab)
