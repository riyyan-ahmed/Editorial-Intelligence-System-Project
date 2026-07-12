"""
Evaluation metric computation.
  hTER  — token-level edit distance (no dependencies)
  chrF  — character n-gram F-score via sacrebleu
  COMET — neural metric via unbabel-comet (optional, skipped if not installed)
"""
from sacrebleu.metrics import CHRF as SacreCHRF


# ── hTER ─────────────────────────────────────────────────────────────────────

def _token_edit_distance(hyp: list[str], ref: list[str]) -> int:
    """Space-optimised Levenshtein distance at token level."""
    m, n = len(hyp), len(ref)
    if m > 4000: hyp, m = hyp[:4000], 4000
    if n > 4000: ref, n = ref[:4000], 4000
    dp = list(range(n + 1))
    for i in range(1, m + 1):
        prev, dp[0] = dp[0], i
        for j in range(1, n + 1):
            temp = dp[j]
            dp[j] = prev if hyp[i - 1] == ref[j - 1] else 1 + min(prev, dp[j], dp[j - 1])
            prev = temp
    return dp[n]


def compute_hter(hypothesis: str, reference: str) -> float:
    """
    hTER = edit_distance(V1_tokens, V2_tokens) / len(V2_tokens)
    Range: 0–∞ (capped at 2.0 in practice). Lower = better.
    Baseline: 0.8371 (Greek V0→V2).
    """
    hyp_tokens = hypothesis.lower().split()
    ref_tokens  = reference.lower().split()
    if not ref_tokens:
        return 1.0
    dist = _token_edit_distance(hyp_tokens, ref_tokens)
    return round(dist / len(ref_tokens), 4)


# ── chrF ─────────────────────────────────────────────────────────────────────

def compute_chrf(hypothesis: str, reference: str) -> float:
    """
    chrF2 (β=2, character 6-gram F-score) via sacrebleu.
    Range: 0–100. Higher = better.
    Baseline: 56.28 (Greek V0→V2).
    """
    scorer = SacreCHRF(beta=2)
    score  = scorer.sentence_score(hypothesis, [reference])
    return round(score.score, 2)


# ── COMET ────────────────────────────────────────────────────────────────────

def compute_comet(source: str, hypothesis: str, reference: str) -> float | None:
    """
    COMET (Unbabel/wmt22-comet-da).
    Returns None if the comet package or model is not available.
    Range: ~0–1. Higher = better.
    Requires: pip install unbabel-comet  AND  model downloaded on first run.
    """
    try:
        from comet import download_model, load_from_checkpoint
        model_path = download_model("Unbabel/wmt22-comet-da")
        model      = load_from_checkpoint(model_path)
        data       = [{"src": source, "mt": hypothesis, "ref": reference}]
        output     = model.predict(data, batch_size=1, gpus=0)
        return round(float(output.scores[0]), 4)
    except Exception:
        return None


# ── Combined ─────────────────────────────────────────────────────────────────

def compute_all(hypothesis: str, reference: str, source: str = "") -> dict:
    """
    Run all three metrics.
    hTER and chrF always succeed.
    COMET returns None if package/model unavailable.
    """
    return {
        "hter_score":  compute_hter(hypothesis, reference),
        "chrf_score":  compute_chrf(hypothesis, reference),
        "comet_score": compute_comet(source, hypothesis, reference),
    }
