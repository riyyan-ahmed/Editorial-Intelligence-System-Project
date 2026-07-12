# MediaSync 2.1 Implementation Plan

Use `Report/MediaSync_2_1_Practical_Execution_Plan.pdf` from the original project workspace as the client-facing plan.

This repository implements that plan with the following practical sequence:

1. Add authenticated cluster APIs to the FastAPI backend.
2. Add cluster dashboard inside the React app.
3. Add cluster detail, sources, and article inspection.
4. Refactor RAG source selection to use `cluster_members.mmr_rank`.
5. Connect cluster context to existing author-style generation.
6. Save generation history for cluster-generated drafts.
7. Connect existing feedback/evaluation flow to cluster drafts.
8. Deploy the unified app separately on AWS under `/data/mediasync21`.

