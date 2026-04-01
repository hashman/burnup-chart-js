"""Role and permission definitions."""

from enum import Enum

from fastapi import Depends

from auth import get_current_user, require_role


class SystemRole(str, Enum):
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"


# Convenience dependencies
require_admin = require_role(SystemRole.ADMIN)
require_member_or_admin = require_role(SystemRole.ADMIN, SystemRole.MEMBER)
