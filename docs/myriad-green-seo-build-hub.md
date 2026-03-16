# Myriad Green SEO Build Hub

## Operating Rule

This hub is the single source of truth for the SEO page generation build.

A task is **only marked finished** when:

1. The developer explicitly confirms it is complete, and
2. The output has been audited against the acceptance criteria in this hub.

If either is missing, the task remains **Pending** or **Needs Audit**.

---

## Status Legend

* **Pending** — not started
* **In Progress** — currently being worked on
* **Needs Audit** — developer says done, but not yet checked
* **Blocked** — cannot continue due to missing dependency
* **Finished** — developer confirmed and audit passed

---

## Project Goal

Build a production-ready scalable SEO page generation system for Myriad Green that can create and manage suburb-based service pages from a template, structured data source, and generation workflow.

---

# Phase 0 — Governance and Workflow

## 0.1 Build Rules

**Status:** Pending

### Acceptance Criteria

* A single markdown hub exists
* Every task has status, scope, and acceptance criteria
* No task is marked finished without dev confirmation + audit
* Next phase does not proceed until required prior tasks are audited

### Audit Checklist

* Hub file exists
* Status legend exists
* Acceptance criteria exist for each active task
* Completion rule is visible at top

---

# Phase 1 — Foundation Setup

## 1.1 Confirm Current Site Structure

**Status:** Pending

### Scope

Document the current production or working folder structure for the Myriad Green site.

### Required Output

* Root folders
* CSS folders/files
* JS folders/files
* HTML partials/components
* Existing service page directories
* Current sitemap location if present

### Acceptance Criteria

* Dev provides actual folder tree or zipped structure summary
* Paths are exact, not approximate
* Existing SEO-relevant files are identified

### Audit Checklist

* Paths match actual project structure
* Existing templates/partials are listed
* No guessed file names are treated as confirmed

## 1.2 Confirm Deployment Environment

**Status:** Needs Audit

### Scope

Identify how the site is deployed and what the generator must output for compatibility.

### Required Output

* Hosting method
* Static export requirement
* Build process if any
* Whether trailing slash folder routing is supported
* Whether `/services/<slug>/<suburb>/index.html` is valid on host

### Acceptance Criteria

* Dev confirms hosting setup
* URL format is confirmed
* Output format constraints are known

### Audit Checklist

* Routing format tested or confirmed
* No unverified deployment assumptions remain

## 1.3 Confirm Canonical SEO File Locations

**Status:** In Progress

### Scope

Identify where SEO-critical assets live now.

### Required Output

* Main CSS files
* Main JS init file
* Reusable nav/footer partials
* Current service page template or closest equivalent
* Robots.txt and sitemap.xml locations if present

### Acceptance Criteria

* Exact paths supplied
* Reusable files identified
* Potential conflicts noted

### Audit Checklist

* All paths verified
* Existing reusable infrastructure is compatible with scaling plan

---

# Phase 2 — Template System

## 2.1 Create Base SEO Service-Area Template

**Status:** Finished

### Scope

Build the production HTML template for suburb-based service pages.

### Required Output

* One reusable template file
* Semantic HTML5 structure
* Placeholder variables for dynamic data
* Modular nav/footer injection compatibility
* CTA and trust sections

### Acceptance Criteria

* Template file created in confirmed templates location
* Valid semantic structure
* Variables are consistently named
* Works with current site-init/component injection approach

### Audit Checklist

* `<title>` unique and templated
* Meta description templated
* Canonical templated
* H1 unique and templated
* Main content sections present
* No broken asset paths
* Mobile-first structure retained

## 2.2 Add Structured Data Support

**Status:** Pending

### Scope

Add schema placeholders appropriate for local service pages.

### Required Output

* JSON-LD block in template
* Fields for service, area served, provider, URL
* Safe fallback structure for missing optional fields

### Acceptance Criteria

* Schema present in template
* Variables map to generator fields
* Output is valid JSON-LD format

### Audit Checklist

* No malformed commas/quotes
* Schema type fits page purpose
* URL and service name are templated

## 2.3 Add Internal Linking Block

**Status:** Pending

### Scope

Create a reusable nearby areas / related services / relevant guides block.

### Required Output

* Related suburb links section
* Main service page link
* Optional blog/article links area

### Acceptance Criteria

* Link section exists in template
* Designed to accept generated links
* Structure is crawlable and accessible

### Audit Checklist

* Links are plain anchor tags
* No JS-only dependency for crawlability
* Headings are meaningful

---

# Phase 3 — Data Model

## 3.1 Define Master CSV Schema

**Status:** Finished

### Scope

Define the exact columns required to generate pages.

### Required Output

Confirmed column list for:

* service
* service_slug
* suburb
* suburb_slug
* city
* title
* meta_description
* hero_intro
* problem_1
* problem_2
* problem_3
* process_intro
* faq_1_q / faq_1_a
* faq_2_q / faq_2_a
* faq_3_q / faq_3_a
* canonical_url

### Acceptance Criteria

* Column list is finalized
* Required vs optional fields are marked
* Naming is consistent with template variables

### Audit Checklist

* No duplicate semantic fields
* Slugs are distinct from display names
* All template variables have matching data fields

# Phase 3 — Dataset Population

## 3.2 Populate Services Dataset

**Status:** Pending

## 3.3 Populate Suburbs Dataset

**Status:** Pending

## 3.2 Build Initial 150-Page Dataset

**Status:** Pending

### Scope

Create the first production dataset for 5 services x 30 suburbs.

### Required Output

* CSV or spreadsheet with all rows
* Approved suburb list
* Approved service list

### Acceptance Criteria

* 150 rows exist
* Slugs are normalized
* No duplicate URL combinations

### Audit Checklist

* Row count correct
* No repeated canonicals
* No empty required fields

---

# Phase 4 — Generator Script

## 4.1 Create Page Generation Script

**Status:** Pending

### Scope

Build the script that reads the dataset and generates production page files.

### Required Output

* Script file
* Input path config
* Template loading
* Variable replacement or render engine
* Output folder generation

### Acceptance Criteria

* Script runs without fatal errors
* Creates correct folder structure
* Generates HTML pages from dataset

### Audit Checklist

* Output paths match deployment constraints
* Template variables are fully replaced
* Missing fields are handled safely
* Script can be re-run without corrupting output

## 4.2 Add Slug and Path Validation

**Status:** Pending

### Scope

Prevent bad file names and duplicate paths.

### Required Output

* Validation for slugs
* Duplicate path detection
* Required field checks

### Acceptance Criteria

* Script fails clearly on invalid rows
* Duplicate outputs are blocked
* Empty required fields are reported

### Audit Checklist

* Invalid rows produce readable errors
* No silent overwrites occur

---

# Phase 5 — SEO Output Controls

## 5.1 Auto-Generate Metadata Correctly

**Status:** Pending

### Scope

Ensure each page outputs unique metadata.

### Required Output

* Title tags
* Meta descriptions
* Canonicals
* Open Graph basics

### Acceptance Criteria

* Each page has unique metadata
* Lengths are reasonable
* Canonical matches final URL

### Audit Checklist

* No duplicate titles in sample audit
* No missing descriptions
* Canonicals resolve to intended path

## 5.2 Generate XML Sitemap

**Status:** Pending

### Scope

Create or update sitemap generation for new pages.

### Required Output

* Sitemap generation file or script
* Inclusion of all generated service-area pages

### Acceptance Criteria

* Sitemap includes new URLs
* XML is valid
* Location matches deployment setup

### Audit Checklist

* Sample URLs present
* No malformed XML
* No duplicate entries

---

# Phase 6 — QA and Audit

## 6.1 Generate 3-Page Test Batch

**Status:** Pending

### Scope

Before full launch, generate 3 representative pages.

### Required Output

* 1 Pretoria East page
* 1 Johannesburg page
* 1 Centurion page

### Acceptance Criteria

* Pages render correctly
* Metadata correct
* Internal linking works

### Audit Checklist

* Review source HTML
* Review rendered browser output
* Review mobile structure
* Review schema presence

## 6.2 Full 150-Page Generation Audit

**Status:** Pending

### Scope

Audit the first full batch before publish.

### Required Output

* Generated output set
* URL list
* Error log if any

### Acceptance Criteria

* 150 intended pages generated
* No broken placeholders remain
* No duplicate URLs or titles in audited sample

### Audit Checklist

* Random sample of 10 pages
* Check title/meta/H1/canonical
* Check nav/footer injection
* Check CTA presence
* Check schema output

---

# Phase 7 — Publish Readiness

## 7.1 Publish Checklist

**Status:** Pending

### Scope

Confirm the output is ready for deployment.

### Acceptance Criteria

* Pages generated
* Sitemap updated
* Internal links working
* No critical audit failures remain

### Audit Checklist

* Hosting-compatible structure
* Search Console submission path ready
* Robots rules do not block pages

## 7.2 Indexing and Monitoring Setup

**Status:** Pending

### Scope

Prepare first indexing and tracking steps.

### Required Output

* Search Console submission checklist
* Analytics/monitoring note
* Crawl verification checklist

### Acceptance Criteria

* Submission plan documented
* Initial index monitoring steps documented

### Audit Checklist

* Sitemap URL known
* Representative URLs queued for inspection

---

# Current Execution Order

1. 1.1 Confirm Current Site Structure
2. 1.2 Confirm Deployment Environment
3. 1.3 Confirm Canonical SEO File Locations
4. 2.1 Create Base SEO Service-Area Template
5. 2.2 Add Structured Data Support
6. 2.3 Add Internal Linking Block
7. 3.1 Define Master CSV Schema
8. 3.2 Build Initial 150-Page Dataset
9. 4.1 Create Page Generation Script
10. 4.2 Add Slug and Path Validation
11. 5.1 Auto-Generate Metadata Correctly
12. 5.2 Generate XML Sitemap
13. 6.1 Generate 3-Page Test Batch
14. 6.2 Full 150-Page Generation Audit
15. 7.1 Publish Checklist
16. 7.2 Indexing and Monitoring Setup

---

# Audit Log

## Entry Format

* Task ID:

* Date:

* Developer Confirmation:

* Auditor Result:

* Notes:

* Final Status:

* Task ID: 1.1

* Date: 2026-03-16

* Developer Confirmation: Current site structure provided via VS Code Explorer screenshot.

* Auditor Result: Passed.

* Notes: Confirmed root project, assets/css layer, docs, functions, partials, services, and core root files including robots.txt and sitemap.xml. Missing SEO factory folders were expected at that stage.

* Final Status: Finished

* Task ID: 1.3

* Date: 2026-03-16

* Developer Confirmation: Canonical file locations provided via expanded VS Code Explorer screenshots.

* Auditor Result: Passed.

* Notes: Confirmed CSS stack, JS entry, partials, service pages, and root SEO files.

* Final Status: Finished

* Task ID: 2.1

* Date: 2026-03-16

* Developer Confirmation: Base service-area template scaffold created and later updated to include city in the H1.

* Auditor Result: Initial audit passed structurally; awaiting final verification after H1 adjustment.

* Notes: Template includes semantic sections, metadata placeholders, JSON-LD placeholder, existing CSS stack, and site-init.js.

* Final Status: Needs Audit

* Task ID: 1.2

* Date: 2026-03-16

* Developer Confirmation: Deployment target confirmed as Domains.co.za.

* Auditor Result: Passed for architecture planning.

* Notes: Static shared-hosting style output with folder-based routing is the active deployment assumption for build decisions.

* Final Status: Finished

---

# Change Log

## 2026-03-16

* Initial build hub created
* Completion workflow locked: dev confirmation + audit required
* Phase sequence defined
* Phase 1.1 audited and marked finished
* Phase 1.2 audited and marked finished for architecture planning
* Phase 1.3 audited and marked finished
* Phase 2.1 moved to Needs Audit after template creation and H1 refinement
* Phase 3.1 moved to In Progress
