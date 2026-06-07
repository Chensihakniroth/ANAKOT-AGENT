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
- **searxng-search**: Privacy-focused search
- **osint-investigation**: Open-source intelligence

### 3. Support Infrastructure
- **web_extract**: Content extraction and processing
- **web_search**: General web querying
- **search_files**: File-based content search

## Deep Research Patterns and Methodologies

### 1. Iterative Breadth-Then-Depth Search

The most important pattern for comprehensive research is the iterative search methodology:

```
Round 1 (Breadth): 4-6 parallel queries covering different angles
  - "[method] + [domain]"
  - "[problem name] state-of-the-art"
  - "[baseline method] comparison"
  - "[alternative approach] vs [your approach]"
  → Collect papers, extract key concepts and terminology

Round 2 (Depth): Generate follow-up queries from Round 1 learnings
  - New terminology discovered in Round 1 papers
  - Papers cited by the most relevant Round 1 results
  - Contradictory findings that need investigation
  → Collect papers, identify remaining gaps

Round 3 (Targeted): Fill specific gaps
  - Missing baselines identified in Rounds 1-2
  - Concurrent work (last 6 months, same problem)
  - Key negative results or failed approaches
  → Stop when new queries return mostly papers you've already seen
```

**Key Implementation Details:**
- For agent-based workflows: Delegate each round's queries in parallel via `delegate_task`
- Collect results, deduplicate, then generate the next round's queries from combined learnings
- Stop when a round returns >80% papers already in collection (typically 2-3 rounds suffice)
- Survey papers may require 4-5 rounds

### 2. Knowledge Compounding with LLM Wiki

The LLM Wiki system implements a three-layer architecture for knowledge compounding:

```
Layer 1 — Raw Sources (immutable/):
  ├── articles/     # Web articles, clippings
  ├── papers/       # PDFs, arxiv papers
  ├── transcripts/  # Meeting notes, interviews
  └── assets/       # Images, diagrams

Layer 2 — The Wiki (agent-owned):
  ├── entities/     # People, orgs, products, models
  ├── concepts/     # Concept/topic pages
  ├── comparisons/   # Side-by-side analyses
  └── queries/       # Filed query results

Layer 3 — The Schema (structure/rules):
  ├── SCHEMA.md     # Conventions, structure rules
  ├── index.md      # Content catalog
  └── log.md        # Chronological action log
```

**Key Features:**
- **Persistent knowledge base**: Unlike traditional RAG, knowledge is compiled once and kept current
- **Cross-references**: Links between pages are maintained automatically
- **Contradiction detection**: Conflicting claims are flagged and tracked
- **Provenance tracking**: Each claim can be traced back to its source
- **Quality signals**: Confidence levels and contested status indicators

### 3. Research Paper Writing Pipeline

A comprehensive 7-phase pipeline for research paper creation:

```
Phase 0: Project Setup
Phase 1: Literature Review
Phase 2: Experiment Design
Phase 3: Execution & Monitoring
Phase 4: Analysis
Phase 5: Paper Drafting
Phase 6: Self-Review & Revision
Phase 7: Submission
```

**Core Philosophy:**
- **Proactivity**: Deliver complete drafts, not questions
- **No hallucinated citations**: Always fetch citations programmatically
- **Paper as story**: Every paper needs one clear contribution in a single sentence
- **Experiments serve claims**: Every experiment must explicitly support a paper claim
- **Git discipline**: Commit early and often with descriptive messages

## Core Research Skills Deep Dive

### 1. arxiv Skill

**Purpose**: Academic paper discovery and analysis via arXiv REST API

**Key Capabilities:**
- XML-based paper searching with advanced query syntax
- BibTeX generation for proper citations
- Integration with Semantic Scholar for citation data
- Version-aware paper handling (v1, v2, etc.)

**Search Query Syntax:**
```
all:transformer+attention     # All fields
ti:large+language+models     # Title only
au:vaswani                   # Author only
abs:reinforcement+learning   # Abstract only
cat:cs.AI                    # Category
co:accepted+NeurIPS          # Comment
```

**Implementation Pattern:**
```bash
# Clean output parsing
curl -s "https://export.arxiv.org/api/query?search_query=all:QUERY&max_results=5" | python3 -c "
import sys, xml.etree.ElementTree as ET
# ... parsing logic for clean output
"
```

### 2. LLM Wiki Skill

**Purpose**: Build and maintain a persistent, compounding knowledge base

**Key Operations:**
- **Ingest**: Process sources into raw format, then create/update wiki pages
- **Query**: Search and synthesize answers from existing knowledge
- **Lint**: Health-check the wiki for issues
- **Archive**: Handle superseded content

**Page Structure:**
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

**Cross-referencing Rules:**
- Every page must link to at least 2 other pages via `[[wikilinks]]`
- Use provenance markers `^[raw/articles/source.md]` for claims from specific sources
- Tags must come from predefined taxonomy

### 3. Research Paper Writing Skill

**Purpose**: End-to-end pipeline for ML/AI research papers

**Key Features:**
- **Multi-author coordination**: Workflows for teams
- **Experiment tracking**: Git-based experiment journal
- **Statistical analysis**: Proper significance testing
- **Human evaluation**: Design and analysis patterns
- **Publication-ready**: LaTeX formatting and submission prep

**Experiment Journal Pattern:**
```json
{
  "id": "exp_003",
  "parent": "exp_001",
  "timestamp": "2026-06-07T14:30:00Z",
  "hypothesis": "Adding scope constraints will fix convergence failure",
  "plan": "Re-run autoreason with max_tokens=2000",
  "status": "completed",
  "key_metrics": {"win_rate": 0.85, "convergence_rounds": 3},
  "next_steps": ["Try same constraints on Sonnet"]
}
```

### 4. Parallel CLI Skill

**Purpose**: Advanced web search, extraction, and enrichment capabilities

**Key Workflows:**
- **Deep Research**: Multi-step research with processors (lite/core/ultra)
- **Enrichment**: Add columns to CSV/JSON data via web research
- **FindAll**: Web-scale entity discovery
- **Monitor**: Ongoing change detection

**Async Pattern:**
```bash
# Launch async research
parallel-cli research "Compare AI coding agents" --processor ultra --no-wait --json

# Poll for status
parallel-cli research status trun_xxx --json

# Get results
parallel-cli research poll trun_xxx --json
```

## Integration Patterns

### 1. Citation Verification Workflow

**Mandatory 5-step process for each citation:**
1. **SEARCH**: Query Semantic Scholar or Exa MCP with specific keywords
2. **VERIFY**: Confirm paper exists in 2+ sources
3. **RETRIEVE**: Get BibTeX via DOI content negotiation
4. **VALIDATE**: Confirm the claim actually appears in the paper
5. **ADD**: Add verified BibTeX to bibliography

**Implementation:**
```python
def doi_to_bibtex(doi: str) -> str:
    response = requests.get(
        f"https://doi.org/{doi}",
        headers={"Accept": "application/x-bibtex"}
    )
    response.raise_for_status()
    return response.text
```

### 2. Multi-Source Synthesis Pattern

**Process for combining multiple sources:**
1. **Extract**: Use `web_extract` for each source
2. **De-duplicate**: Remove redundant information
3. **Cross-reference**: Identify conflicting claims
4. **Synthesize**: Create coherent summary with provenance markers
5. **File**: Save as wiki page or research note

### 3. Research Workflow Orchestration

**Sequential pattern for complex research:**
1. **Discovery**: Use arxiv and web_search to find sources
2. **Ingestion**: Process sources into llm-wiki
3. **Analysis**: Query wiki for insights and patterns
4. **Experimentation**: Design and run supporting experiments
5. **Synthesis**: Write paper drawing on all findings

## Implementation Details

### 1. Tool Registration Pattern

Research tools follow a consistent registration pattern:

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

### 2. Memory Management

**Research memory types:**
- **User memories**: Researcher background and preferences
- **Feedback memories**: Research approach guidance
- **Project memories**: Ongoing research initiatives
- **Reference memories**: External system pointers

**Memory persistence**: All research state is maintained in `~/.anakot/memory/` for cross-session continuity.

### 3. Error Handling Patterns

**Common failure modes and recovery:**
- **API rate limits**: Implement exponential backoff
- **Content drift**: SHA256 checksum detection for re-ingestion
- **Missing sources**: Fallback to alternative sources
- **Contradictions**: Flag for human review rather than resolution

### 4. Performance Optimization

**Strategies for large-scale research:**
- **Parallel processing**: Delegate research rounds to subagents
- **Caching**: Store extracted content and analysis results
- **Incremental updates**: Only process changed content
- **Selective deepening**: Focus efforts on high-impact sources

## Best Practices

### 1. Research Quality Control

**Citation Verification:**
- Never generate BibTeX from memory
- Always fetch programmatically via DOI
- Mark unverifiable citations as `[CITATION NEEDED]`

**Source Evaluation:**
- Check recency (especially for fast-moving fields)
- Verify author credentials and publication venue
- Cross-check claims across multiple sources

**Synthesis Quality:**
- Attribute claims to specific sources
- Flag conflicting information with dates
- Maintain distinction between facts and interpretations

### 2. Knowledge Management

**Wiki Maintenance:**
- Orient before operating (read SCHEMA.md, index.md, log.md)
- Regular linting for broken links and orphans
- Archive superseded content rather than deleting
- Rotate logs when exceeding 500 entries

**Cross-referencing:**
- Minimum 2 outbound links per page
- Use provenance markers for multi-source claims
- Update links when target pages change

### 3. Research Workflow Management

**Project Setup:**
- Define clear contribution statement before writing
- Estimate compute budget before running experiments
- Set up version control from the start
- Create structured TODO list for tracking

**Experiment Management:**
- Save results incrementally for crash recovery
- Maintain experiment journal for decision tracking
- Commit completed results with descriptive messages
- Implement monitoring for long-running experiments

## Use Cases and Examples

### 1. Literature Review Deep Dive

**Scenario**: Comprehensive literature review for a new ML method

**Workflow:**
1. **Initial discovery**: `arxiv` search for method + domain
2. **Breadth phase**: 4 parallel queries covering different angles
3. **Depth phase**: Follow up on promising citations and terminology
4. **Synthesis**: Create wiki pages for key concepts and papers
5. **Analysis**: Identify research gaps and opportunities

### 2. Competitive Intelligence Research

**Scenario**: Understanding competitive landscape in AI coding tools

**Workflow:**
1. **Discovery**: `parallel-cli research` for comprehensive analysis
2. **Enrichment**: Add company details to existing dataset
3. **Monitoring**: Set up ongoing tracking of developments
4. **Synthesis**: Create comparison pages and competitive analysis

### 3. Academic Paper Production

**Scenario**: Producing a publication-ready ML research paper

**Workflow:**
1. **Project setup**: Define contribution and experiment plan
2. **Literature review**: Iterative search and wiki compilation
3. **Experiment design**: Map claims to experimental validation
4. **Execution**: Run experiments with monitoring and journaling
5. **Analysis**: Statistical analysis and result interpretation
6. **Writing**: Draft paper with proper citations
7. **Review**: Self-review and revision based on feedback

## Technical Implementation

### 1. Core Architecture & Connection Flow

The deep research system follows a modular, plugin-based architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Application Layer                         │
│  (run_agent.py, cli.py, batch_runner.py, gateway/run.py)              │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Orchestration Layer                          │
│  (model_tools.py - Tool discovery, function calling, async bridging)   │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Registry Layer                               │
│  (tools/registry.py - Central tool registry and dispatch)              │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Tool Implementation Layer                    │
│  (tools/*.py, skills/research/*, skills/research/*/SKILL.md)           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2. Tool Registration & Discovery Pattern

**Registry Flow:**
```python
# tools/registry.py - Central registry singleton
registry = ToolRegistry()

# Each tool registers at module import time
registry.register(
    name="arxiv_search",
    toolset="research",
    schema={...},
    handler=arxiv_search_function,
    check_fn=lambda: bool(os.getenv("ARXIV_API_KEY", True)),  # Always available
    requires_env=[],
    is_async=False,
    description="Search arXiv academic papers",
)

# Auto-discovery in model_tools.py
def discover_builtin_tools(tools_dir: Path = None) -> List[str]:
    """Import built-in self-registering tool modules"""
    module_names = [
        f"tools.{path.stem}"
        for path in sorted(tools_path.glob("*.py"))
        if _module_registers_tools(path)  # AST-based detection
    ]
    return [importlib.import_module(mod_name) for mod_name in module_names]
```

**Tool Entry Structure:**
```python
class ToolEntry:
    __slots__ = (
        "name", "toolset", "schema", "handler", "check_fn",
        "requires_env", "is_async", "description", "emoji",
        "max_result_size_chars", "dynamic_schema_overrides",
    )
```

### 3. Function Calling & Execution Workflow

**Complete Execution Flow:**
```
1. User Request → AIAgent.run_conversation()
   ↓
2. Tool Selection → get_tool_definitions() (from model_tools.py)
   ↓
3. Schema Generation → registry.get_definitions()
   ↓
4. LLM Call → OpenAI API with tools
   ↓
5. Tool Dispatch → registry.dispatch()
   ↓
6. Async Bridging → _run_async() if needed
   ↓
7. Handler Execution → Tool-specific function
   ↓
8. Result Serialization → JSON response
   ↓
9. Response Formatting → Back to conversation loop
```

**Async Bridging Pattern:**
```python
# model_tools.py - Sync/Async bridge
def _run_async(coro):
    """Handle sync->async conversion for tool handlers"""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
    
    if loop and loop.is_running():
        # Inside async context - run in fresh thread
        return _run_in_worker_thread(coro)
    else:
        # CLI context - use persistent loop
        return _get_tool_loop().run_until_complete(coro)
```

### 4. Research Tool Implementation Patterns

#### arxiv Tool Implementation
```python
# tools/arxiv_tool.py (conceptual)
def arxiv_search_handler(args: dict, task_id: str = None) -> str:
    """Search arXiv and return structured results"""
    query = args.get("query", "")
    max_results = args.get("max_results", 10)
    
    # Build API URL
    url = f"https://export.arxiv.org/api/query?search_query=all:{query}&max_results={max_results}"
    
    # Make request
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    
    # Parse XML response
    root = ET.fromstring(response.content)
    entries = root.findall('a:entry', {'a': 'http://www.w3.org/2005/Atom'})
    
    # Format results
    results = []
    for entry in entries:
        results.append({
            "title": entry.find('a:title').text.strip(),
            "authors": [a.find('a:name').text for a in entry.findall('a:author')],
            "published": entry.find('a:published').text[:10],
            "summary": entry.find('a:summary').text.strip(),
            "arxiv_id": entry.find('a:id').text.split('/abs/')[-1]
        })
    
    return tool_result(results)
```

#### LLM Wiki Tool Implementation
```python
# tools/llm_wiki_tool.py (conceptual)
def wiki_ingest_handler(args: dict, task_id: str = None) -> str:
    """Process source into wiki structure"""
    source_url = args.get("url")
    wiki_path = os.getenv("WIKI_PATH", "~/wiki")
    
    # 1. Extract raw content
    raw_content = web_extract(urls=[source_url])
    
    # 2. Compute SHA256 for drift detection
    content_hash = hashlib.sha256(raw_content.encode()).hexdigest()
    
    # 3. Save raw source with frontmatter
    raw_file = f"{wiki_path}/raw/articles/{uuid.uuid4()}.md"
    with open(raw_file, 'w') as f:
        f.write(f"""---
source_url: {source_url}
ingested: {datetime.now().isoformat()}
sha256: {content_hash}
---

{raw_content}
""")
    
    # 4. Analyze content and identify entities/concepts
    # 5. Update or create wiki pages
    # 6. Update index.md and log.md
    
    return tool_result({"processed": True, "pages_updated": 5})
```

### 5. Research Workflow Orchestration

#### Iterative Breadth-Then-Depth Implementation
```python
def deep_research_workflow(research_question: str, max_rounds: int = 3) -> dict:
    """Execute iterative deep research pattern"""
    all_results = []
    previous_queries = []
    
    for round_num in range(1, max_rounds + 1):
        print(f"Research Round {round_num}/{max_rounds}")
        
        # Generate queries based on current knowledge
        if round_num == 1:
            # Breadth: initial parallel queries
            queries = generate_breadth_queries(research_question)
        else:
            # Depth: follow-up based on previous results
            queries = generate_depth_queries(previous_queries, all_results)
        
        # Execute queries in parallel
        round_results = []
        for query in queries:
            if query not in [q['query'] for q in previous_queries]:
                result = arxiv_search_handler({"query": query, "max_results": 10})
                round_results.append({"query": query, "result": result})
        
        previous_queries.extend(round_results)
        all_results.extend(round_results)
        
        # Check for saturation
        if is_research_saturated(round_results, all_results):
            print("Research saturation reached")
            break
    
    return synthesize_research_findings(all_results)
```

#### Citation Verification Workflow
```python
def verify_citation(doi: str) -> dict:
    """5-step citation verification process"""
    result = {
        "doi": doi,
        "verified": False,
        "bibtex": None,
        "sources_verified": [],
        "claim_found": False
    }
    
    # Step 1: Search via multiple sources
    sources = [
        search_semantic_scholar(doi),
        search_crossref(doi),
        search_arxiv_direct(doi)
    ]
    result["sources_verified"] = [s for s in sources if s is not None]
    
    # Step 2: Verify existence in 2+ sources
    if len(result["sources_verified"]) >= 2:
        # Step 3: Retrieve BibTeX
        result["bibtex"] = fetch_bibtex_via_doi(doi)
        
        # Step 4: Validate claim (requires paper content)
        if result["bibtex"]:
            paper_content = fetch_paper_content(doi)
            # Validate specific claim exists in content
            # This would be domain-specific
            
        result["verified"] = True
    
    return result
```

### 6. Knowledge Base Management System

#### Wiki Structure Management
```python
class WikiManager:
    def __init__(self, wiki_path: str):
        self.wiki_path = Path(wiki_path)
        self.raw_path = self.wiki_path / "raw"
        self.entities_path = self.wiki_path / "entities"
        self.concepts_path = self.wiki_path / "concepts"
        self.schema_path = self.wiki_path / "SCHEMA.md"
        
    def orient(self):
        """Read orientation files before operations"""
        self.schema = self.read_yaml(self.schema_path)
        self.index = self.read_markdown(self.wiki_path / "index.md")
        self.log = self.read_markdown(self.wiki_path / "log.md")
        
    def ingest_source(self, source_data: dict) -> list:
        """Process source and update wiki pages"""
        updated_pages = []
        
        # 1. Save raw source
        raw_file = self.save_raw_source(source_data)
        
        # 2. Extract entities and concepts
        extracted = self.extract_entities_concepts(source_data['content'])
        
        # 3. Update existing pages or create new ones
        for entity in extracted['entities']:
            page = self.update_entity_page(entity, raw_file)
            if page:
                updated_pages.append(page)
                
        for concept in extracted['concepts']:
            page = self.update_concept_page(concept, raw_file)
            if page:
                updated_pages.append(page)
                
        # 4. Update navigation
        self.update_index(updated_pages)
        self.update_log(source_data, updated_pages)
        
        return updated_pages
```

#### Cross-Reference Management
```python
def maintain_cross_references(wiki_path: str):
    """Ensure all pages have proper outbound links"""
    pages = list_all_wiki_pages(wiki_path)
    link_map = build_inbound_link_map(pages)
    
    issues = []
    
    for page in pages:
        # Check for broken links
        broken_links = find_broken_links(page, pages)
        if broken_links:
            issues.append(f"Broken links in {page}: {broken_links}")
        
        # Check for minimum outbound links
        outbound_links = extract_outbound_links(page)
        if len(outbound_links) < 2:
            issues.append(f"Insufficient outbound links in {page} (found {len(outbound_links)})")
    
    return issues
```

### 7. Research Paper Pipeline Implementation

#### Experiment Journal Pattern
```python
class ExperimentJournal:
    def __init__(self, journal_path: str):
        self.journal_path = Path(journal_path)
        
    def log_experiment(self, experiment_data: dict):
        """Log experiment with full metadata"""
        entry = {
            "id": f"exp_{uuid.uuid4().hex[:6]}",
            "timestamp": datetime.now().isoformat(),
            **experiment_data
        }
        
        # Append to journal
        with open(self.journal_path, 'a') as f:
            f.write(json.dumps(entry) + '\n')
            
    def get_experiment_tree(self) -> dict:
        """Build experiment decision tree"""
        entries = self.load_journal_entries()
        tree = {}
        
        for entry in entries:
            parent_id = entry.get('parent')
            if parent_id:
                if parent_id not in tree:
                    tree[parent_id] = []
                tree[parent_id].append(entry['id'])
                
        return tree
```

#### Statistical Analysis Pipeline
```python
def analyze_experiment_results(results_dir: str) -> dict:
    """Run statistical analysis on experiment results"""
    results = load_all_results(results_dir)
    
    analysis = {
        "descriptive_stats": {},
        "statistical_tests": {},
        "effect_sizes": {},
        "confidence_intervals": {}
    }
    
    # Descriptive statistics
    for strategy, tasks in results.items():
        scores = [t['score'] for t in tasks.values()]
        analysis["descriptive_stats"][strategy] = {
            "mean": np.mean(scores),
            "std": np.std(scores),
            "median": np.median(scores),
            "n": len(scores)
        }
    
    # Pairwise comparisons
    strategies = list(results.keys())
    for i, strat1 in enumerate(strategies):
        for strat2 in strategies[i+1:]:
            # McNemar's test for binary outcomes
            # Cohen's d for continuous outcomes
            # Bootstrap confidence intervals
            pass
    
    return analysis
```

### 8. Configuration & Environment Setup

#### Tool Configuration Pattern
```python
# toolsets.py - Toolset definitions
_RESEARCH_CORE_TOOLS = [
    "arxiv",
    "web_search", 
    "web_extract",
    "search_files"
]

_RESEARCH_ADVANCED_TOOLS = [
    "parallel-cli",
    "llm-wiki",
    "semantic-scholar"
]

def resolve_toolset(toolset_name: str, enabled_toolsets: list = None) -> list:
    """Resolve toolset to actual tool names"""
    toolsets = {
        "basic_research": _RESEARCH_CORE_TOOLS,
        "advanced_research": _RESEARCH_CORE_TOOLS + _RESEARCH_ADVANCED_TOOLS,
        "academic_papers": ["arxiv", "semantic-scholar"],
        "web_research": ["web_search", "web_extract", "parallel-cli"]
    }
    
    return toolsets.get(toolset_name, [])
```

#### Environment Management
```python
# Environment variable management for research tools
RESEARCH_ENV_VARS = {
    "WIKI_PATH": {
        "description": "Path to knowledge base directory",
        "default": "~/wiki",
        "required": False
    },
    "ARXIV_API_KEY": {
        "description": "arXiv API key (not required for public access)",
        "default": None,
        "required": False
    },
    "PARALLEL_API_KEY": {
        "description": "Parallel CLI API key",
        "default": None,
        "required": False
    },
    "SEMANTIC_SCHOLAR_API_KEY": {
        "description": "Semantic Scholar API key for enhanced search",
        "default": None,
        "required": False
    }
}
```

### 9. Error Handling & Resilience Patterns

#### Tool Error Handling
```python
def safe_tool_execution(tool_name: str, args: dict, **kwargs) -> str:
    """Execute tool with comprehensive error handling"""
    try:
        # Check tool availability
        entry = registry.get_entry(tool_name)
        if not entry:
            return tool_error(f"Unknown tool: {tool_name}")
            
        # Check requirements
        if entry.requires_env:
            missing_env = [env for env in entry.requires_env 
                         if not os.getenv(env)]
            if missing_env:
                return tool_error(f"Missing environment variables: {missing_env}")
        
        # Execute with timeout
        if entry.is_async:
            return _run_async_with_timeout(
                entry.handler(args, **kwargs), 
                timeout=300
            )
        else:
            return entry.handler(args, **kwargs)
            
    except Exception as e:
        logger.exception(f"Tool {tool_name} execution failed: {e}")
        return tool_error(f"Execution failed: {type(e).__name__}: {str(e)}")
```

#### Content Drift Detection
```python
def detect_content_drift(raw_file_path: str) -> bool:
    """Detect if source content has changed since last ingest"""
    with open(raw_file_path, 'r') as f:
        content = f.read()
    
    # Split into frontmatter and body
    parts = content.split('---\n', 3)
    if len(parts) >= 3:
        frontmatter = parts[1]
        body = parts[2] if len(parts) == 3 else parts[2]
        
        # Parse stored hash
        metadata = yaml.safe_load(frontmatter)
        stored_hash = metadata.get('sha256')
        
        # Compute current hash
        current_hash = hashlib.sha256(body.encode()).hexdigest()
        
        return stored_hash != current_hash
    
    return False
```

### 10. Performance Optimization

#### Parallel Tool Execution
```python
def execute_parallel_tools(tool_calls: list, max_concurrent: int = 4) -> list:
    """Execute multiple tools in parallel with controlled concurrency"""
    results = []
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def execute_with_semaphore(tool_call):
        async with semaphore:
            return await safe_tool_execution(
                tool_call['name'], 
                tool_call['args']
            )
    
    # Run all tools in parallel batches
    tasks = [execute_with_semaphore(call) for call in tool_calls]
    batch_results = asyncio.gather(*tasks)
    
    return batch_results
```

#### Result Caching
```python
class ResearchCache:
    """Cache for research results to avoid redundant processing"""
    
    def __init__(self, cache_dir: str):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        
    def get_cache_key(self, tool_name: str, args: dict) -> str:
        """Generate cache key for tool call"""
        key_data = {
            "tool": tool_name,
            "args": args,
            "timestamp": datetime.now().isoformat()
        }
        return hashlib.md5(json.dumps(key_data).encode()).hexdigest()
    
    def get_cached_result(self, cache_key: str) -> Optional[dict]:
        """Check if result exists in cache"""
        cache_file = self.cache_dir / f"{cache_key}.json"
        if cache_file.exists():
            try:
                with open(cache_file, 'r') as f:
                    return json.load(f)
            except Exception:
                return None
        return None
    
    def cache_result(self, cache_key: str, result: dict, ttl_hours: int = 24):
        """Cache result with TTL"""
        cache_file = self.cache_dir / f"{cache_key}.json"
        result_with_expiry = {
            "data": result,
            "expires_at": (datetime.now() + timedelta(hours=ttl_hours)).isoformat()
        }
        
        with open(cache_file, 'w') as f:
            json.dump(result_with_expiry, f)
```

### 11. Integration Points

#### Memory System Integration
```python
# Memory integration for research contexts
class ResearchMemoryManager:
    def __init__(self, memory_path: str):
        self.memory_path = Path(memory_path)
        
    def save_research_context(self, session_id: str, context: dict):
        """Save research context to memory"""
        memory_file = self.memory_path / f"research_{session_id}.md"
        
        with open(memory_file, 'w') as f:
            f.write(f"""---
session_id: {session_id}
timestamp: {datetime.now().isoformat()}
type: research_context
---

## Research Question
{context['question']}

## Methodology
{context['methodology']}

## Key Findings
{context['findings']}

## Next Steps
{context['next_steps']}
""")
```

#### Session Management
```python
# Session integration for cross-research continuity
class ResearchSession:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.wiki_manager = WikiManager(os.getenv("WIKI_PATH"))
        self.experiment_journal = ExperimentJournal("experiments.jsonl")
        self.memory_manager = ResearchMemoryManager("memory")
        
    def continue_research(self, new_question: str):
        """Continue previous research session"""
        # Load previous context
        previous_context = self.memory_manager.load_research_context(self.session_id)
        
        # Update wiki with new question context
        self.wiki_manager.update_session_context(self.session_id, new_question)
        
        # Generate follow-up queries based on previous work
        follow_up_queries = generate_follow_up_queries(
            new_question, 
            previous_context
        )
        
        return follow_up_queries
```

### 12. Testing & Quality Assurance

#### Tool Testing Patterns
```python
# Test pattern for research tools
def test_arxiv_search():
    """Test arXiv search functionality"""
    # Mock API response
    mock_response = MockResponse(
        content=build_mock_arxiv_response(),
        status_code=200
    )
    
    with patch('requests.get', return_value=mock_response):
        result = arxiv_search_handler({"query": "machine learning", "max_results": 5})
        
        assert result["status"] == "success"
        assert len(result["results"]) == 5
        assert all("title" in r for r in result["results"])

def test_citation_verification():
    """Test 5-step citation verification"""
    test_doi = "10.1234/example"
    
    # Test each verification step
    with patch('semantic_scholar_api.get_paper') as mock_ss, \
         patch('crossref_api.get_paper') as mock_cr, \
         patch('arxiv_api.get_paper') as mock_arxiv:
        
        # Mock successful verification
        mock_ss.return_value = {"title": "Test Paper"}
        mock_cr.return_value = {"title": "Test Paper"}
        mock_arxiv.return_value = None
        
        result = verify_citation(test_doi)
        
        assert result["verified"] == True
        assert result["sources_verified"] == 2
        assert result["bibtex"] is not None
```

#### Research Quality Checks
```python
def validate_research_output(research_output: dict) -> dict:
    """Validate research output for quality and completeness"""
    validation_report = {
        "valid": True,
        "issues": [],
        "warnings": []
    }
    
    # Check citation requirements
    if research_output.get("citations"):
        uncited_claims = find_uncited_claims(research_output["content"])
        if uncited_claims:
            validation_report["warnings"].append(
                f"{len(uncited_claims)} claims lack citations"
            )
    
    # Check source freshness
    if research_output.get("sources"):
        stale_sources = find_stale_sources(research_output["sources"])
        if stale_sources:
            validation_report["warnings"].append(
                f"{len(stale_sources)} sources are over 2 years old"
            )
    
    # Check structural completeness
    required_sections = ["introduction", "methods", "results", "conclusion"]
    missing_sections = [
        section for section in required_sections 
        if section not in research_output.get("structure", {})
    ]
    
    if missing_sections:
        validation_report["issues"].append(
            f"Missing sections: {', '.join(missing_sections)}"
        )
        validation_report["valid"] = False
    
    return validation_report
```

This comprehensive technical implementation shows how the deep research functionality is built with:
- Modular architecture with clear separation of concerns
- Robust error handling and resilience patterns
- Performance optimization through caching and parallel execution
- Quality assurance through validation and testing
- Extensible design for adding new research capabilities
- Integration with broader system components (memory, sessions, etc.)

## Conclusion

The deep research functionality in the Anakot Agent project provides a comprehensive system for conducting sophisticated research across multiple domains. The system combines automated discovery, persistent knowledge management, rigorous quality control, and production-ready output capabilities.

Key strengths include:
- **Iterative deepening**: Ensures comprehensive coverage of research topics
- **Knowledge compounding**: Builds persistent, cross-referenced knowledge bases
- **Quality assurance**: Rigorous citation verification and validation
- **Scalability**: Parallel processing and delegation for large-scale research
- **Integration**: Seamless workflow from discovery to publication

This system can be adapted and integrated into other projects by following the documented patterns, maintaining quality standards, and leveraging the extensible tool architecture.