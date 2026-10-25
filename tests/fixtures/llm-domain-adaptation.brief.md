# Research Brief

## Question
How should a small engineering team (3-5 engineers) adapt an open-weight large language model
(7B-70B parameters) to a domain-specific task, such as extracting structured fields from
technical documents, and how should the chosen approach be built, evaluated and served?

## Context
The team has a domain task that general-purpose prompting handles poorly: outputs miss
domain terms, break the required format or are inconsistent between runs. Options range from
better prompting and retrieval-augmented generation (RAG) to parameter-efficient fine-tuning
(LoRA, QLoRA), full fine-tuning and distillation into a smaller model. The team needs a
technical proposal for which approach to adopt and how to run it in production.

## Scope
- In scope: prompting and few-shot methods, RAG, LoRA/QLoRA and other parameter-efficient
  methods, full fine-tuning, distillation, hybrids (for example RAG plus fine-tuning); training
  data needs (amount, labelling, synthetic data); catastrophic forgetting; evaluation methods
  and metrics; training and serving infrastructure (single node, adapter serving,
  quantisation); maintenance when the base model is replaced; published comparisons and
  real-world deployments.
- Out of scope: pre-training a model from scratch, closed models available only through an
  external API, multimodal (image or audio) tasks, choosing GPU hardware vendors.

## Constraints
- Training and serving run on one node with 1-8 GPUs.
- The domain data is private and must not be sent to an external API.
- A first production version is needed within 3 months.
- Prefer approaches with published evidence from 2023 onward, including independent
  replications, not only results reported by a method's authors.

## Decision criteria
1. Task accuracy on the domain task, measured by task-specific metrics
2. Amount and kind of training data needed
3. Training and serving cost (GPU hours, memory, latency)
4. Maintenance effort when the base model or the domain data changes
5. Time to first production version

## Audience
ML / platform engineering team. They need the approach with trade-offs, data requirements,
evaluation approach, serving architecture and a phased build plan.

## Known sources (optional)
- Original papers for LoRA, QLoRA and related parameter-efficient methods
- Independent comparisons of fine-tuning and RAG on knowledge-heavy tasks
- Documentation of open-source training and serving tools (for example Hugging Face PEFT, vLLM)
