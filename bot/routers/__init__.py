from aiogram import Router

from bot.routers.admin import router as admin_router
from bot.routers.cancel import router as cancel_router
from bot.routers.health import router as health_router
from bot.routers.inbox import router as inbox_router
from bot.routers.leads import router as leads_router
from bot.routers.client_feedback import router as client_feedback_router
from bot.routers.my_leads import router as my_leads_router
from bot.routers.start import router as start_router

router = Router(name="root")
router.include_router(start_router)
router.include_router(cancel_router)
router.include_router(health_router)
router.include_router(leads_router)
router.include_router(my_leads_router)
router.include_router(client_feedback_router)
router.include_router(admin_router)
router.include_router(inbox_router)
