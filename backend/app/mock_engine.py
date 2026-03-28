from __future__ import annotations

from dataclasses import dataclass

from .schemas import ChatHistoryMessage, ChatResponse, ModelId, ResolutionSections, ResolutionSource


MODEL_LABELS: dict[ModelId, str] = {
    "llama3.1:8b": "Ollama Llama 3.1 8B",
    "gpt-4o-mini": "GPT-4o-mini",
}


@dataclass(frozen=True)
class MockResolutionTemplate:
    keywords: tuple[str, ...]
    diagnostic_label: str
    answer_lead: str
    sections: ResolutionSections
    sources: list[ResolutionSource]
    latency_ms: int


FALLBACK_TEMPLATE = MockResolutionTemplate(
    keywords=(),
    diagnostic_label="General SAP incident triage",
    answer_lead=(
        "I could not map this message to one of the seeded incidents, so the safest next step is to "
        "capture fuller SAP context and route the query through the real provider adapter later."
    ),
    sections=ResolutionSections(
        businessContext=(
            "The incident appears to be part of a normal SAP business transaction, but the exact module "
            "and affected object are still unclear."
        ),
        rootCause=(
            "The starter backend is using seeded diagnostic patterns. It can already serve the frontend, "
            "but it is not yet connected to a retrieval pipeline or live model provider."
        ),
        steps=[
            "Capture the complete SAP error text, transaction code, and business step.",
            "Include any document number, plant, warehouse, or logical system referenced in the message.",
            "Store the enriched prompt and connect this API to a real model adapter in the next phase.",
        ],
        prevention=[
            "Use a standard incident template for SAP support handoffs.",
            "Store verified fixes with module tags, T-codes, and system context.",
        ],
    ),
    sources=[
        ResolutionSource(
            title="Starter backend response",
            system="FastAPI foundation",
            origin="Seeded API response",
            summary="The backend contract is live and ready to be replaced with a real provider adapter.",
            confidence="Starter",
        )
    ],
    latency_ms=420,
)


TEMPLATES: tuple[MockResolutionTemplate, ...] = (
    MockResolutionTemplate(
        keywords=("gap", "gaps", "spaces", "numbers", "number range"),
        diagnostic_label="/SCWM/LT 120 - Numeric entry or number-range issue",
        answer_lead=(
            "I found a close SAP EWM pattern. Start with the simplest cause first: remove any spaces "
            "from the numeric field, then confirm the related number range is still valid in SAP."
        ),
        sections=ResolutionSections(
            businessContext=(
                "This usually appears in warehouse execution when a user enters a document, handling unit, "
                "or number-range-driven identifier during an operational step."
            ),
            rootCause=(
                "The input often contains hidden spaces or formatting noise. In some cases, the backing "
                "number range is exhausted or misaligned."
            ),
            steps=[
                "Re-enter the affected value manually and make sure it contains digits only.",
                "Verify the field expects a numeric identifier and not a mixed-format key.",
                "Inspect the relevant number range setup for remaining capacity.",
                "Retry the posting or warehouse task creation after the field or number range is corrected.",
            ],
            prevention=[
                "Validate copied numeric values before saving documents.",
                "Monitor critical number ranges before they run out in production.",
            ],
        ),
        sources=[
            ResolutionSource(
                title="Enter the numbers without any gaps",
                system="SAP EWM",
                origin="Seeded backend pattern",
                summary="Check input format and ensure the number contains no spaces or formatting noise.",
                confidence="High match",
            ),
            ResolutionSource(
                title="Number range review in SNRO",
                system="SAP Basis / EWM",
                origin="Seeded backend pattern",
                summary="Extend or correct the affected interval if the numeric object is close to exhaustion.",
                confidence="Medium match",
            ),
        ],
        latency_ms=690,
    ),
    MockResolutionTemplate(
        keywords=("logical system", "bd54", "rfc", "destination"),
        diagnostic_label="Logical system connectivity and assignment",
        answer_lead=(
            "This looks like a landscape mapping issue. Check the logical system definition, its "
            "assignment, and the RFC destination that supports the cross-system call."
        ),
        sections=ResolutionSections(
            businessContext=(
                "The failure usually appears when one SAP component needs to call another system or client "
                "during integration, outbound processing, or master-data synchronization."
            ),
            rootCause=(
                "A logical system is missing, assigned incorrectly, or linked to the wrong RFC destination. "
                "Client-specific customizing can also drift between environments."
            ),
            steps=[
                "Review the logical system entry in BD54 and confirm the expected name exists.",
                "Check the object or client assignment that should point to that logical system.",
                "Validate the related RFC destination and run a connection test.",
                "Retry the original interface or posting after the mapping is corrected.",
            ],
            prevention=[
                "Transport logical system customizing carefully between environments.",
                "Keep an integration checklist for client copies, RFC changes, and system refreshes.",
            ],
        ),
        sources=[
            ResolutionSource(
                title="Error while accessing logical system",
                system="SAP integration",
                origin="Seeded backend pattern",
                summary="Validate logical system assignment and the downstream RFC setup before retrying.",
                confidence="High match",
            ),
            ResolutionSource(
                title="BD54 logical system maintenance",
                system="SAP Basis",
                origin="Seeded backend pattern",
                summary="Confirm the object name, client mapping, and landscape consistency.",
                confidence="Medium match",
            ),
        ],
        latency_ms=720,
    ),
    MockResolutionTemplate(
        keywords=("delivery", "posting change", "outbound", "warehouse task"),
        diagnostic_label="Delivery posting or follow-on document failure",
        answer_lead=(
            "The incident points to a document status mismatch. Review the delivery status, queue the "
            "failed follow-on action again, and verify dependent warehouse or output steps."
        ),
        sections=ResolutionSections(
            businessContext=(
                "These issues often happen when shipping, warehouse execution, and follow-on posting steps "
                "are slightly out of sync after a document update."
            ),
            rootCause=(
                "A dependent document or status update did not complete cleanly, leaving the outbound "
                "delivery in a partially processed state."
            ),
            steps=[
                "Check the delivery document status and identify which follow-on action failed.",
                "Review application logs or queue entries tied to the delivery update.",
                "Resolve the blocking dependency, then repeat the posting change or follow-on job.",
                "Confirm warehouse tasks, output determination, and delivery completion are back in sync.",
            ],
            prevention=[
                "Track repeated queue failures by document type.",
                "Alert on outbound deliveries that remain in intermediate statuses for too long.",
            ],
        ),
        sources=[
            ResolutionSource(
                title="Outbound delivery posting mismatch",
                system="SAP LE / EWM",
                origin="Seeded backend pattern",
                summary="Investigate the blocked follow-on update before retrying the business step.",
                confidence="Likely match",
            )
        ],
        latency_ms=660,
    ),
    MockResolutionTemplate(
        keywords=("batch", "classification", "gr", "goods receipt", "material"),
        diagnostic_label="Batch or classification data missing during receipt",
        answer_lead=(
            "This looks like a master-data completeness issue. Check the batch management settings and "
            "whether the expected classification data exists for the material and plant."
        ),
        sections=ResolutionSections(
            businessContext=(
                "The error tends to appear during goods receipt or batch creation when material-specific "
                "classification data is required before the document can post."
            ),
            rootCause=(
                "Batch management is active, but the relevant class assignment, characteristics, or "
                "plant-level material settings are incomplete."
            ),
            steps=[
                "Confirm the material is correctly set up for batch management in the affected scope.",
                "Review the assigned class and required characteristics for the batch creation process.",
                "Populate the missing classification or batch master data, then retry the goods receipt.",
                "Validate that downstream inventory and quality processes can see the same batch attributes.",
            ],
            prevention=[
                "Add a master-data readiness check before go-live or cutover activities.",
                "Use validation rules for materials that require mandatory batch attributes.",
            ],
        ),
        sources=[
            ResolutionSource(
                title="Batch classification missing at receipt",
                system="SAP MM / QM",
                origin="Seeded backend pattern",
                summary="Review class assignment and required characteristics before posting goods receipt.",
                confidence="Likely match",
            )
        ],
        latency_ms=680,
    ),
)


def pick_template(query: str) -> MockResolutionTemplate:
    normalized = query.lower()
    for template in TEMPLATES:
        if any(keyword in normalized for keyword in template.keywords):
            return template
    return FALLBACK_TEMPLATE


def build_chat_response(query: str, model: ModelId, history: list[ChatHistoryMessage]) -> ChatResponse:
    template = pick_template(query)
    history_hint = (
        f" This conversation already contains {len(history)} earlier message(s), which is useful once "
        "a persistent conversation store is added."
        if history
        else " This is the first message in the current conversation."
    )
    model_tail = (
        " The next step is to connect this starter API to OpenAI-compatible or provider-specific adapters."
        if model == "gpt-4o-mini"
        else " The next step is to connect this starter API to a local or self-hosted model adapter."
    )

    return ChatResponse(
        answer=f"{template.answer_lead}{history_hint}{model_tail}",
        diagnostic_label=template.diagnostic_label,
        sections=template.sections,
        sources=template.sources,
        latency_ms=template.latency_ms,
        model=model,
        requested_model=model,
        generation_model=model,
        generation_label=MODEL_LABELS[model],
        generation_note="Seeded FastAPI starter backend response.",
    )

