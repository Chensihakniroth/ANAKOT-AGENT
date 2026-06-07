# Deep Research Functionality Documentation

## Overview

The Anakot Agent project implements a sophisticated deep research system that enables comprehensive investigation, analysis, and knowledge compilation across multiple domains. This system is built around several interconnected research skills that provide different aspects of deep research capabilities.

## Research Ecosystem Architecture

The deep research ecosystem consists of three main layers:

### 1. Core Research Skills
- **arxiv**: Academic paper discovery and analysis
- **llm-wiki**: Persistent knowledge base building
- **research-paper-writing**: Full research paper pipeline

### 2. Specialized Research Tools
- **parallel-cli**: Advanced web search and enrichment
- **duckduckgo-search**: General web search
- **searxng-search**: Privacy‑focused search
- **osint-investigation**: Open‑source intelligence

### 3. Support Infrastructure
- **web_extract**: Content extraction and processing
- **web_search**: General web querying
- **search_files**: File‑based content search

## Deep Research Patterns and Methodologies

### 1. Iterative Breadth‑Then‑Depth Search

The most important pattern for comprehensive research is the iterative search methodology:

```
Round 1 (Breadth): 4‑6 parallel queries covering different angles
  - "[method] + [domain]"
  - "[problem name] state‑of‑the‑art"
  - "[baseline method] comparison"
  - "[alternative approach] vs [your approach]"
  → Collect papers, extract key concepts and terminology

Round 2 (Depth): Generate follow‑up queries from Round 1 learnings
  - New terminology discovered in Round 1 papers
  - Papers cited by the most relevant Round 1 results
  - Contradictory findings that need investigation
  → Collect papers, identify remaining gaps

Round 3 (Targeted): Fill specific gaps
  - Missing baselines identified in Rounds 1‑2
  - Concurrent work (last 6 months, same problem)
  - Key negative results or failed approaches
  → Stop when new queries return mostly papers you’ve already seen
```

**Key Implementation Details:**
- Delegate each round’s queries in parallel via `delegate_task`.
- Collect results, deduplicate, then generate the next round’s queries from combined learnings.
- Stop when a round returns > 80 % papers already in the collection (typically 2‑3 rounds).
- Survey papers may require 4‑5 rounds.

### 2. Knowledge Compounding with LLM Wiki

The LLM Wiki system implements a three‑layer architecture for knowledge compounding:

```
Layer 1 — Raw Sources (immutable):
  ├── articles/     # Web articles, clippings
  ├── papers/       # PDFs, arXiv papers
  ├── transcripts/  # Meeting notes, interviews
  └── assets/       # Images, diagrams

Layer 2 — The Wiki (agent‑owned):
  ├── entities/     # People, orgs, products, models
  ├── concepts/     # Concept/topic pages
  ├── comparisons/  # Side‑by‑side analyses
  └── queries/      # Filed query results

Layer 3 — The Schema (structure/rules):
  ├── SCHEMA.md     # Conventions, structure rules
  ├── index.md      # Content catalog
  └── log.md        # Chronological action log
```

**Key Features:**
- Persistent knowledge base (unlike traditional RAG).
- Automatic cross‑references between pages.
- Contradiction detection with flagging for human review.
- Provenance tracking for every claim.
- Confidence signals (high/medium/low) and contested status.

### 3. Research Paper Writing Pipeline

A comprehensive 7‑phase pipeline for research paper creation:

```
Phase 0: Project Setup
Phase 1: Literature Review
Phase 2: Experiment Design
Phase 3: Execution & Monitoring
Phase 4: Analysis
Phase 5: Paper Drafting
Phase 6: Self‑Review & Revision
Phase 7: Submission
```

**Core Philosophy:**
- Proactivity – deliver complete drafts, not questions.
- No hallucinated citations – always fetch programmatically.
- A single clear contribution statement per paper.
- Every experiment must explicitly support a claim.
- Git discipline – commit early, often, with descriptive messages.

## Core Research Skills Deep Dive

### 1. arxiv Skill

**Purpose:** Academic paper discovery and analysis via the arXiv REST API.

**Key Capabilities:**
- XML‑based searching with advanced query syntax.
- BibTeX generation for proper citations.
- Integration with Semantic Scholar for citation data.
- Version‑aware handling (v1, v2, …).

**Search Query Syntax:**
```
all:transformer+attention     # All fields
ti:large+language+models     # Title only
au:vaswani                   # Author only
abs:reinforcement+learning   # Abstract only
cat:cs.AI                    # Category
co:accepted+NeurIPS          # Comment
```

### 2. LLM Wiki Skill

**Purpose:** Build and maintain a persistent, compounding knowledge base.

**Page Front‑matter Example:**
```yaml
---
title: Page Title
created: 2026-06-07
updated: 2026-06-07
type: entity | concept | comparison | query | summary
tags: [from taxonomy]
sources: [raw/articles/source-file.md]
confidence: high | medium | low
contested: true
contradictions: [other-page-slug]
---
```

**Cross‑referencing Rules:**
- Every page must link to at least two other pages via `[[wikilinks]]`.
- Use provenance markers `^[raw/articles/source.md]` for claims.
- Tags must come from a predefined taxonomy.

### 3. Research Paper Writing Skill

**Purpose:** End‑to‑end pipeline for ML/AI research papers.

**Experiment Journal Pattern (JSON):**
```json
{
  "id": "exp_003",
  "parent": "exp_001",
  "timestamp": "2026-06-07T14:30:00Z",
  "hypothesis": "Adding scope constraints will fix convergence failure",
  "plan": "Re‑run autoreason with max_tokens=2000",
  "status": "completed",
  "key_metrics": {"win_rate": 0.85, "convergence_rounds": 3},
  "next_steps": ["Try same constraints on Sonnet"]
}
```

## Integration Patterns

### 1. Citation Verification Workflow (5‑step)
1. **SEARCH** – Query Semantic Scholar or CrossRef.
2. **VERIFY** – Confirm the paper exists in ≥ 2 sources.
3. **RETRIEVE** – Get BibTeX via DOI content negotiation.
4. **VALIDATE** – Ensure the claim appears in the paper.
5. **ADD** – Insert verified BibTeX into the bibliography.

```python
import requests

def doi_to_bibtex(doi: str) -> str:
    resp = requests.get(
        f"https://doi.org/{doi}",
        headers={"Accept": "application/x-bibtex"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.text
```

### 2. Multi‑Source Synthesis Pattern
1. **Extract** – `web_extract` each source.
2. **De‑duplicate** – Remove redundant information.
3. **Cross‑reference** – Flag conflicting claims.
4. **Synthesize** – Produce a coherent summary with provenance.
5. **File** – Save as a wiki page or research note.

### 3. Research Workflow Orchestration
1. **Discovery** – `arxiv` + `web_search`.
2. **Ingestion** – Process sources into `llm‑wiki`.
3. **Analysis** – Query the wiki for insights.
4. **Experimentation** – Design and run supporting experiments.
5. **Synthesis** – Write the paper using the compiled knowledge.

## Implementation Details

### Tool Registration Pattern
```python
registry.register(
    name="research_tool",
    toolset="research",
    schema={...},
    handler=lambda args, **kw: research_function(args, task_id=kw.get("task_id")),
    check_fn=lambda: bool(os.getenv("RESEARCH_API_KEY")),
    requires_env=["RESEARCH_API_KEY"],
)
```

### Memory Management
- User, feedback, project, and reference memories are stored under `~/.anakot/memory/`.
- Research‑specific memories (e.g., preferred breadth‑depth parameters) belong in the **project** category.

## Best Practices

### Research Quality Control
- Never generate BibTeX from memory; always fetch via DOI.
- Evaluate source recency and author credibility.
- Attribute every claim to a concrete source.

### Knowledge Management
- Run `wiki lint` regularly to catch broken links.
- Archive superseded pages rather than deleting them.
- Keep `index.md` and `log.md` up to date.

### Workflow Management
- Commit early, often, with descriptive messages.
- Log experiments incrementally for crash recovery.
- Use `delegate_task` for parallel query rounds.

## Use Cases

### 1. Literature Review Deep Dive
1. **Initial discovery** – `arxiv` search for the method + domain.
2. **Breadth phase** – 4 parallel queries covering different angles.
3. **Depth phase** – Follow‑up on promising citations and terminology.
4. **Synthesis** – Create wiki pages for key concepts and papers.
5. **Analysis** – Identify gaps and opportunities.

### 2. Competitive Intelligence Research
1. **Discovery** – `parallel-cli research` for a comprehensive view.
2. **Enrichment** – Add company details to the dataset.
3. **Monitoring** – Ongoing tracking of competitor releases.
4. **Synthesis** – Comparison pages and competitive analysis.

### 3. Academic Paper Production
1. **Setup** – Define contribution statement.
2. **Literature review** – Iterative search & wiki compilation.
3. **Experiment design** – Map claims to experiments.
4. **Execution** – Run experiments with monitoring.
5. **Analysis** – Statistical testing.
6. **Writing** – Draft with verified citations.
7. **Review** – Self‑review and revision.

## Technical Implementation

### Core Architecture & Connection Flow
```
Application Layer (run_agent.py, cli.py, …) → Orchestration Layer (model_tools.py) → Registry Layer (tools/registry.py) → Tool Implementation Layer (tools/*.py, skills/*)
```

### Tool Registration & Discovery
```python
registry.register(
    name="arxiv_search",
    toolset="research",
    schema={...},
    handler=arxiv_search_handler,
    check_fn=lambda: True,
)
```

### Async Bridging Pattern
```python
def _run_async(coro):
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
    if loop and loop.is_running():
        return _run_in_worker_thread(coro)
    else:
        return _get_tool_loop().run_until_complete(coro)
```

### Research Workflow Orchestration (Pseudo‑code)
```python
def deep_research_workflow(question: str, max_rounds: int = 3) -> dict:
    all_results = []
    prior_queries = []
    for rnd in range(1, max_rounds + 1):
        queries = generate_queries(question, rnd, prior_queries, all_results)
        round_res = []
        for q in queries:
            if q not in {pq['query'] for pq in prior_queries}:
                res = arxiv_search_handler({"query": q, "max_results": 10})
                round_res.append({"query": q, "result": res})
        prior_queries.extend(round_res)
        all_results.extend(round_res)
        if saturation_detected(round_res, all_results):
            break
    return synthesize_findings(all_results)
```

### Citation Verification (Pseudo‑code)
```python
def verify_citation(doi: str) -> dict:
    sources = [search_semantic_scholar(doi), search_crossref(doi), search_arxiv_direct(doi)]
    verified = len([s for s in sources if s]) >= 2
    bib = fetch_bibtex_via_doi(doi) if verified else None
    return {"doi": doi, "verified": verified, "bibtex": bib}
```

### Wiki Management (Skeleton)
```python
class WikiManager:
    def __init__(self, root: str):
        self.root = Path(root)
    def ingest(self, source):
        raw_path = self.root / "raw" / "articles" / f"{uuid.uuid4()}.md"
        raw_path.write_text(source['content'])
        # extract entities/concepts → update pages
```

## Research Paper Pipeline Details

### Experiment Journal
```python
class ExperimentJournal:
    def __init__(self, path: str):
        self.path = Path(path)
    def log(self, data: dict):
        entry = {"id": f"exp_{uuid.uuid4().hex[:6]}", "timestamp": datetime.utcnow().isoformat(), **data}
        self.path.open('a').write(json.dumps(entry) + "\n")
```

### Statistical Analysis (Skeleton)
```python
def analyze(dir_path: str) -> dict:
    results = load_all_json(dir_path)
    # compute descriptive stats, t‑tests, effect sizes, CI
    return stats
```

--- End of Documentation ---
