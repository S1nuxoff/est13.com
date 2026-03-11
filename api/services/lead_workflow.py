from __future__ import annotations

from est13_core.db.models.enums import LeadStatus


CLIENT_ONLY_LEAD_STATUSES: set[LeadStatus] = {
    LeadStatus.filling,
    LeadStatus.abandoned,
    LeadStatus.awaiting_review,
}


ADMIN_LEAD_TRANSITIONS: dict[LeadStatus, set[LeadStatus]] = {
    LeadStatus.in_review: {
        LeadStatus.confirmed,
        LeadStatus.studio_cancelled,
    },
    LeadStatus.confirmed: {
        LeadStatus.in_work,
        LeadStatus.rejected,
        LeadStatus.lost,
    },
    LeadStatus.in_work: {
        LeadStatus.paused,
        LeadStatus.done,
        LeadStatus.rejected,
        LeadStatus.lost,
        LeadStatus.studio_cancelled,
    },
    LeadStatus.paused: {
        LeadStatus.in_work,
        LeadStatus.done,
        LeadStatus.rejected,
        LeadStatus.lost,
        LeadStatus.studio_cancelled,
    },
    LeadStatus.done: {LeadStatus.delivered},
    LeadStatus.delivered: {LeadStatus.closed, LeadStatus.client_not_confirmed},
    LeadStatus.client_not_confirmed: {
        LeadStatus.in_work,
        LeadStatus.rejected,
        LeadStatus.lost,
    },
    LeadStatus.rejected: {LeadStatus.closed},
    LeadStatus.lost: {LeadStatus.closed},
    LeadStatus.studio_cancelled: {LeadStatus.closed},
    LeadStatus.closed: set(),
}
