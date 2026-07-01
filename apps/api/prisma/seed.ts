import {
  PrismaClient,
  CompanyPlan,
  CompanyStatus,
  EntityType,
  LeaveApprovalMode,
  LeaveDurationType,
  LeaveRequestType,
  LeaveStatus,
  Locale,
  SystemRole,
  TaskPriority,
  TaskStatus,
  UserStatus
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ids = {
  platformCompany: "00000000-0000-4000-8000-000000000001",
  advancedTech: "00000000-0000-4000-8000-000000000101",
  leadingGroup: "00000000-0000-4000-8000-000000000102",
  platformAdmin: "00000000-0000-4000-8000-000000001001",
  companyAdmin: "00000000-0000-4000-8000-000000001101",
  manager: "00000000-0000-4000-8000-000000001102",
  employee: "00000000-0000-4000-8000-000000001103",
  itDept: "00000000-0000-4000-8000-000000002101",
  hrDept: "00000000-0000-4000-8000-000000002102"
};

const permissionSeeds = [
  ["read", "companies", "Read companies"],
  ["write", "companies", "Create and update companies"],
  ["read", "users", "Read users"],
  ["write", "users", "Create and update users"],
  ["view_team", "users", "View direct reports"],
  ["read", "roles", "Read roles"],
  ["write", "roles", "Create and update roles"],
  ["read", "departments", "Read departments"],
  ["write", "departments", "Create and update departments"],
  ["read", "audit_logs", "Read audit logs"],
  ["read", "activities", "Read activity feed"],
  ["read", "attachments", "Read attachments"],
  ["write", "attachments", "Create and update attachments"],
  ["read", "comments", "Read comments"],
  ["write", "comments", "Create and update comments"],
  ["read", "notifications", "Read notifications"],
  ["write", "notifications", "Create and update notifications"],
  ["read", "smtp_settings", "Read SMTP settings"],
  ["write", "smtp_settings", "Create and update SMTP settings"],
  ["read", "search", "Use global search"],
  ["read", "approval_workflows", "Read approval workflows"],
  ["write", "approval_workflows", "Create and update approval workflows"],
  ["read", "tags", "Read tags"],
  ["write", "tags", "Create and update tags"],
  ["read", "user_preferences", "Read user preferences"],
  ["write", "user_preferences", "Create and update user preferences"],
  ["read", "tasks", "Read tasks"],
  ["create", "tasks", "Create tasks"],
  ["update", "tasks", "Update tasks"],
  ["delete", "tasks", "Delete tasks"],
  ["assign", "tasks", "Assign tasks"],
  ["comment", "tasks", "Comment on tasks"],
  ["attach", "tasks", "Attach files to tasks"],
  ["complete", "tasks", "Complete tasks"],
  ["view_team", "tasks", "View direct-report tasks"],
  ["assign_team", "tasks", "Assign tasks to direct reports"],
  ["read", "leave_requests", "Read leave requests"],
  ["submit", "leave_requests", "Submit leave requests"],
  ["update", "leave_requests", "Update leave requests"],
  ["cancel", "leave_requests", "Cancel leave requests"],
  ["approve", "leave_requests", "Approve leave requests"],
  ["reject", "leave_requests", "Reject leave requests"],
  ["view_team", "leave_requests", "View direct-report leave requests"],
  ["approve_team", "leave_requests", "Approve direct-report leave requests"],
  ["reject_team", "leave_requests", "Reject direct-report leave requests"],
  ["view_team", "calendar", "View direct-report availability calendar"],
  ["read", "leave_types", "Read leave types"],
  ["write", "leave_types", "Create and update leave types"],
  ["read", "leave_balances", "Read leave balances"],
  ["write", "leave_balances", "Create and update leave balances"],
  ["read", "leave_settings", "Read leave settings"],
  ["write", "leave_settings", "Create and update leave settings"],
  ["read", "emails", "Read emails"],
  ["send", "emails", "Send emails"],
  ["manage", "email_templates", "Manage email templates"]
] as const;

const tenantRoleSeeds = [
  [SystemRole.COMPANY_ADMIN, "Company Admin", "Full tenant administration"],
  [SystemRole.MANAGER, "Manager", "Department and team management"],
  [SystemRole.EMPLOYEE, "Employee", "Employee self-service access"]
] as const;

const permissionKey = (action: string, subject: string) => `${subject}:${action}`;

const rolePermissionMatrix: Record<SystemRole, readonly string[]> = {
  [SystemRole.SUPER_ADMIN]: ["*"],
  [SystemRole.COMPANY_ADMIN]: ["*"],
  [SystemRole.MANAGER]: [
    "users:read",
    "users:view_team",
    "departments:read",
    "activities:read",
    "attachments:read",
    "attachments:write",
    "comments:read",
    "comments:write",
    "notifications:read",
    "notifications:write",
    "search:read",
    "approval_workflows:read",
    "tags:read",
    "tags:write",
    "user_preferences:read",
    "user_preferences:write",
    "tasks:read",
    "tasks:create",
    "tasks:update",
    "tasks:delete",
    "tasks:assign",
    "tasks:comment",
    "tasks:attach",
    "tasks:complete",
    "tasks:view_team",
    "tasks:assign_team",
    "leave_requests:read",
    "leave_requests:view_team",
    "leave_requests:approve_team",
    "leave_requests:reject_team",
    "calendar:view_team",
    "leave_types:read",
    "leave_types:write",
    "leave_balances:read",
    "leave_balances:write",
    "leave_settings:read",
    "emails:read",
    "emails:send"
  ],
  [SystemRole.EMPLOYEE]: [
    "users:read",
    "departments:read",
    "activities:read",
    "attachments:read",
    "attachments:write",
    "comments:read",
    "comments:write",
    "notifications:read",
    "notifications:write",
    "search:read",
    "tags:read",
    "user_preferences:read",
    "user_preferences:write",
    "tasks:read",
    "tasks:create",
    "tasks:update",
    "tasks:comment",
    "tasks:attach",
    "tasks:complete",
    "leave_requests:read",
    "leave_requests:submit",
    "leave_requests:update",
    "leave_requests:cancel",
    "leave_types:read",
    "leave_balances:read",
    "leave_settings:read",
    "emails:read",
    "emails:send"
  ]
};

async function seedCompany(company: {
  id: string;
  name: string;
  slug: string;
  plan: CompanyPlan;
  status: CompanyStatus;
  defaultLocale: Locale;
}) {
  await prisma.company.upsert({
    where: { id: company.id },
    update: company,
    create: company
  });
}

async function seedPermissions(companyId: string) {
  for (const [action, subject, description] of permissionSeeds) {
    await prisma.permission.upsert({
      where: { companyId_action_subject: { companyId, action, subject } },
      update: { description },
      create: { companyId, action, subject, description }
    });
  }
}

async function seedRoles(companyId: string, includeSuperAdmin: boolean) {
  const roles = includeSuperAdmin
    ? [[SystemRole.SUPER_ADMIN, "Super Admin", "Platform administration"] as const]
    : tenantRoleSeeds;

  for (const [systemName, name, description] of roles) {
    await prisma.role.upsert({
      where: { companyId_systemName: { companyId, systemName } },
      update: { name, description },
      create: { companyId, systemName, name, description }
    });
  }
}

async function linkRolePermissions(companyId: string) {
  const roles = await prisma.role.findMany({ where: { companyId } });
  const permissions = await prisma.permission.findMany({ where: { companyId } });

  for (const role of roles) {
    const allowedKeys = new Set(rolePermissionMatrix[role.systemName]);
    const allowed = permissions.filter((permission) => allowedKeys.has("*") || allowedKeys.has(permissionKey(permission.action, permission.subject)));

    for (const permission of allowed) {
      await prisma.rolePermission.upsert({
        where: {
          companyId_roleId_permissionId: {
            companyId,
            roleId: role.id,
            permissionId: permission.id
          }
        },
        update: {},
        create: { companyId, roleId: role.id, permissionId: permission.id }
      });
    }
  }
}

async function assignRole(companyId: string, userId: string, systemName: SystemRole) {
  const role = await prisma.role.findUniqueOrThrow({
    where: { companyId_systemName: { companyId, systemName } }
  });

  await prisma.userRole.upsert({
    where: { companyId_userId_roleId: { companyId, userId, roleId: role.id } },
    update: {},
    create: { companyId, userId, roleId: role.id }
  });
}

async function seedTask(input: {
  companyId: string;
  taskNumber: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  departmentId: string;
  createdById: string;
  assigneeIds: string[];
  watcherIds: string[];
  dueAt: Date;
  estimatedHours: number;
  actualHours?: number;
}) {
  const task = await prisma.task.upsert({
    where: {
      companyId_taskNumber: {
        companyId: input.companyId,
        taskNumber: input.taskNumber
      }
    },
    update: {
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      departmentId: input.departmentId,
      dueAt: input.dueAt,
      estimatedHours: input.estimatedHours,
      actualHours: input.actualHours,
      completedAt: input.status === TaskStatus.COMPLETED ? new Date("2026-06-29T12:00:00.000Z") : null,
      deletedAt: null
    },
    create: {
      companyId: input.companyId,
      taskNumber: input.taskNumber,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      departmentId: input.departmentId,
      createdById: input.createdById,
      dueAt: input.dueAt,
      estimatedHours: input.estimatedHours,
      actualHours: input.actualHours,
      completedAt: input.status === TaskStatus.COMPLETED ? new Date("2026-06-29T12:00:00.000Z") : null
    }
  });

  for (const userId of input.assigneeIds) {
    await prisma.taskAssignee.upsert({
      where: {
        companyId_taskId_userId: {
          companyId: input.companyId,
          taskId: task.id,
          userId
        }
      },
      update: { deletedAt: null },
      create: { companyId: input.companyId, taskId: task.id, userId }
    });
  }

  for (const userId of [...new Set([input.createdById, ...input.assigneeIds, ...input.watcherIds])]) {
    await prisma.taskWatcher.upsert({
      where: {
        companyId_taskId_userId: {
          companyId: input.companyId,
          taskId: task.id,
          userId
        }
      },
      update: { deletedAt: null },
      create: { companyId: input.companyId, taskId: task.id, userId }
    });
  }

  await prisma.searchIndex.upsert({
    where: {
      companyId_entityType_entityId: {
        companyId: input.companyId,
        entityType: EntityType.TASK,
        entityId: task.id
      }
    },
    update: {
      title: `${task.taskNumber} ${task.title}`,
      content: [task.taskNumber, task.title, task.description].filter(Boolean).join("\n"),
      deletedAt: null
    },
    create: {
      companyId: input.companyId,
      entityType: EntityType.TASK,
      entityId: task.id,
      title: `${task.taskNumber} ${task.title}`,
      content: [task.taskNumber, task.title, task.description].filter(Boolean).join("\n")
    }
  });

  return task;
}

async function seedLeaveType(companyId: string, input: { name: string; code: string; description?: string; isPaid?: boolean; annualAllowanceDays?: number }) {
  return prisma.leaveType.upsert({
    where: { companyId_code: { companyId, code: input.code } },
    update: {
      name: input.name,
      description: input.description,
      isPaid: input.isPaid ?? true,
      annualAllowanceDays: input.annualAllowanceDays,
      isActive: true,
      deletedAt: null
    },
    create: {
      companyId,
      name: input.name,
      code: input.code,
      description: input.description,
      isPaid: input.isPaid ?? true,
      annualAllowanceDays: input.annualAllowanceDays
    }
  });
}

async function seedDefaultLeaveWorkflow(companyId: string) {
  const setting = await prisma.leaveSetting.upsert({
    where: { companyId },
    update: { approvalMode: LeaveApprovalMode.MANAGER_HR, deletedAt: null },
    create: { companyId, approvalMode: LeaveApprovalMode.MANAGER_HR }
  });
  const [managerRole, companyAdminRole] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { companyId_systemName: { companyId, systemName: SystemRole.MANAGER } } }),
    prisma.role.findUniqueOrThrow({ where: { companyId_systemName: { companyId, systemName: SystemRole.COMPANY_ADMIN } } })
  ]);
  const existing = await prisma.approvalWorkflow.findFirst({
    where: { companyId, entityType: EntityType.LEAVE_REQUEST, deletedAt: null }
  });
  const workflow = existing
    ? await prisma.approvalWorkflow.update({
        where: { id: existing.id },
      data: { name: "Default Leave Request Approval", isActive: true }
    })
    : await prisma.approvalWorkflow.create({
        data: {
          companyId,
          entityType: EntityType.LEAVE_REQUEST,
          name: "Default Leave Request Approval",
          description:
            setting.approvalMode === LeaveApprovalMode.MANAGER_HR
              ? "Employee to manager to HR approval path"
              : "Employee to manager approval path"
        }
      });

  await prisma.approvalStep.upsert({
    where: { companyId_workflowId_stepOrder: { companyId, workflowId: workflow.id, stepOrder: 1 } },
    update: { name: "Manager Approval", approverRoleId: managerRole.id, approverUserId: null, deletedAt: null },
    create: { companyId, workflowId: workflow.id, stepOrder: 1, name: "Manager Approval", approverRoleId: managerRole.id }
  });
  await prisma.approvalStep.upsert({
    where: { companyId_workflowId_stepOrder: { companyId, workflowId: workflow.id, stepOrder: 2 } },
    update: { name: "HR Approval", approverRoleId: companyAdminRole.id, approverUserId: null, deletedAt: null },
    create: { companyId, workflowId: workflow.id, stepOrder: 2, name: "HR Approval", approverRoleId: companyAdminRole.id }
  });

  return workflow;
}

async function seedLeaveBalance(input: {
  companyId: string;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  allocatedDays: number;
  usedDays: number;
}) {
  await prisma.leaveBalance.upsert({
    where: {
      companyId_employeeId_leaveTypeId_year: {
        companyId: input.companyId,
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        year: input.year
      }
    },
    update: {
      allocatedDays: input.allocatedDays,
      usedDays: input.usedDays,
      remainingDays: input.allocatedDays - input.usedDays,
      deletedAt: null
    },
    create: {
      companyId: input.companyId,
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      year: input.year,
      allocatedDays: input.allocatedDays,
      usedDays: input.usedDays,
      remainingDays: input.allocatedDays - input.usedDays
    }
  });
}

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  await seedCompany({
    id: ids.platformCompany,
    name: "TASK Flow Platform",
    slug: "taskflow-platform",
    plan: CompanyPlan.ENTERPRISE,
    status: CompanyStatus.ACTIVE,
    defaultLocale: Locale.EN
  });

  await seedCompany({
    id: ids.advancedTech,
    name: "شركة التقنية المتقدمة",
    slug: "advanced-tech",
    plan: CompanyPlan.ENTERPRISE,
    status: CompanyStatus.ACTIVE,
    defaultLocale: Locale.AR
  });

  await seedCompany({
    id: ids.leadingGroup,
    name: "مجموعة الأعمال الرائدة",
    slug: "leading-business-group",
    plan: CompanyPlan.PROFESSIONAL,
    status: CompanyStatus.ACTIVE,
    defaultLocale: Locale.AR
  });

  for (const companyId of [ids.platformCompany, ids.advancedTech, ids.leadingGroup]) {
    await seedPermissions(companyId);
    await seedRoles(companyId, companyId === ids.platformCompany);
  }

  await prisma.user.upsert({
    where: { companyId_email: { companyId: ids.platformCompany, email: "super@taskflow.local" } },
    update: { name: "Platform Super Admin", passwordHash, status: UserStatus.ACTIVE },
    create: {
      id: ids.platformAdmin,
      companyId: ids.platformCompany,
      email: "super@taskflow.local",
      passwordHash,
      name: "Platform Super Admin",
      jobTitle: "Super Admin",
      locale: Locale.EN,
      status: UserStatus.ACTIVE
    }
  });

  await prisma.user.upsert({
    where: { companyId_email: { companyId: ids.advancedTech, email: "admin@company.com" } },
    update: { name: "أحمد محمد العلي", passwordHash, status: UserStatus.ACTIVE, managerId: null },
    create: {
      id: ids.companyAdmin,
      companyId: ids.advancedTech,
      email: "admin@company.com",
      passwordHash,
      name: "أحمد محمد العلي",
      jobTitle: "مدير الشركة",
      locale: Locale.AR,
      status: UserStatus.ACTIVE
    }
  });

  await prisma.user.upsert({
    where: { companyId_email: { companyId: ids.advancedTech, email: "sara@company.com" } },
    update: { name: "سارة خالد الفارسي", passwordHash, status: UserStatus.ACTIVE, managerId: ids.companyAdmin },
    create: {
      id: ids.manager,
      companyId: ids.advancedTech,
      managerId: ids.companyAdmin,
      email: "sara@company.com",
      passwordHash,
      name: "سارة خالد الفارسي",
      jobTitle: "مدير الموارد البشرية",
      locale: Locale.AR,
      status: UserStatus.ACTIVE
    }
  });

  await prisma.user.upsert({
    where: { companyId_email: { companyId: ids.advancedTech, email: "mohammed@company.com" } },
    update: { name: "محمد عبدالله الحربي", passwordHash, status: UserStatus.ACTIVE, managerId: ids.manager },
    create: {
      id: ids.employee,
      companyId: ids.advancedTech,
      managerId: ids.manager,
      email: "mohammed@company.com",
      passwordHash,
      name: "محمد عبدالله الحربي",
      jobTitle: "موظف مبيعات",
      locale: Locale.AR,
      status: UserStatus.ACTIVE
    }
  });

  await prisma.department.upsert({
    where: { companyId_code: { companyId: ids.advancedTech, code: "IT" } },
    update: { managerId: ids.companyAdmin, name: "تقنية المعلومات" },
    create: {
      id: ids.itDept,
      companyId: ids.advancedTech,
      managerId: ids.companyAdmin,
      name: "تقنية المعلومات",
      code: "IT"
    }
  });

  await prisma.department.upsert({
    where: { companyId_code: { companyId: ids.advancedTech, code: "HR" } },
    update: { managerId: ids.manager, name: "الموارد البشرية" },
    create: {
      id: ids.hrDept,
      companyId: ids.advancedTech,
      managerId: ids.manager,
      name: "الموارد البشرية",
      code: "HR"
    }
  });

  await prisma.user.update({ where: { id: ids.companyAdmin }, data: { departmentId: ids.itDept } });
  await prisma.user.update({ where: { id: ids.manager }, data: { departmentId: ids.hrDept } });
  await prisma.user.update({ where: { id: ids.employee }, data: { departmentId: ids.hrDept } });

  await assignRole(ids.platformCompany, ids.platformAdmin, SystemRole.SUPER_ADMIN);
  await assignRole(ids.advancedTech, ids.companyAdmin, SystemRole.COMPANY_ADMIN);
  await assignRole(ids.advancedTech, ids.manager, SystemRole.MANAGER);
  await assignRole(ids.advancedTech, ids.employee, SystemRole.EMPLOYEE);

  for (const companyId of [ids.platformCompany, ids.advancedTech, ids.leadingGroup]) {
    await linkRolePermissions(companyId);
  }

  await seedTask({
    companyId: ids.advancedTech,
    taskNumber: "TASK-00001",
    title: "إعداد تقرير العمليات الشهري",
    description: "جمع مؤشرات الأداء من الأقسام وتجهيز التقرير للمدير التنفيذي.",
    status: TaskStatus.IN_PROGRESS,
    priority: TaskPriority.HIGH,
    departmentId: ids.itDept,
    createdById: ids.companyAdmin,
    assigneeIds: [ids.manager],
    watcherIds: [ids.employee],
    dueAt: new Date("2026-07-05T09:00:00.000Z"),
    estimatedHours: 8,
    actualHours: 3
  });

  await seedTask({
    companyId: ids.advancedTech,
    taskNumber: "TASK-00002",
    title: "مراجعة ملفات الموظفين الجديدة",
    description: "التأكد من اكتمال المستندات وربطها بملفات الموظفين.",
    status: TaskStatus.ASSIGNED,
    priority: TaskPriority.MEDIUM,
    departmentId: ids.hrDept,
    createdById: ids.manager,
    assigneeIds: [ids.employee],
    watcherIds: [ids.companyAdmin],
    dueAt: new Date("2026-07-08T09:00:00.000Z"),
    estimatedHours: 5
  });

  await seedTask({
    companyId: ids.advancedTech,
    taskNumber: "TASK-00003",
    title: "إغلاق تذاكر الدعم المتأخرة",
    description: "فرز التذاكر المفتوحة وتحديث الحالات قبل نهاية الأسبوع.",
    status: TaskStatus.COMPLETED,
    priority: TaskPriority.CRITICAL,
    departmentId: ids.itDept,
    createdById: ids.companyAdmin,
    assigneeIds: [ids.employee],
    watcherIds: [ids.manager],
    dueAt: new Date("2026-06-29T09:00:00.000Z"),
    estimatedHours: 6,
    actualHours: 6
  });

  const annualLeave = await seedLeaveType(ids.advancedTech, {
    name: "إجازة سنوية",
    code: "ANNUAL",
    description: "رصيد الإجازات السنوية المدفوعة",
    annualAllowanceDays: 21
  });
  const sickLeave = await seedLeaveType(ids.advancedTech, {
    name: "إجازة مرضية",
    code: "SICK",
    description: "الإجازات المرضية المدعومة بتقرير طبي",
    annualAllowanceDays: 14
  });
  const emergencyLeave = await seedLeaveType(ids.advancedTech, {
    name: "إجازة طارئة",
    code: "EMERGENCY",
    description: "إجازات الظروف الطارئة",
    annualAllowanceDays: 5
  });
  await seedLeaveType(ids.advancedTech, {
    name: "إجازة بدون راتب",
    code: "UNPAID",
    description: "إجازة غير مدفوعة",
    isPaid: false
  });
  await seedLeaveType(ids.advancedTech, {
    name: "نصف يوم",
    code: "HALF_DAY",
    description: "طلب إجازة لنصف يوم عمل",
    annualAllowanceDays: 6
  });
  await seedLeaveType(ids.advancedTech, {
    name: "استئذان ساعات",
    code: "PERMISSION",
    description: "استئذان لمدة ساعتين إلى أربع ساعات",
    annualAllowanceDays: 3
  });
  await seedLeaveType(ids.advancedTech, {
    name: "عمل من المنزل",
    code: "WFH",
    description: "طلب عمل من المنزل حسب سياسة الشركة",
    isPaid: true
  });

  await seedLeaveBalance({
    companyId: ids.advancedTech,
    employeeId: ids.employee,
    leaveTypeId: annualLeave.id,
    year: 2026,
    allocatedDays: 21,
    usedDays: 5
  });
  await seedLeaveBalance({
    companyId: ids.advancedTech,
    employeeId: ids.employee,
    leaveTypeId: sickLeave.id,
    year: 2026,
    allocatedDays: 14,
    usedDays: 2
  });
  await seedLeaveBalance({
    companyId: ids.advancedTech,
    employeeId: ids.employee,
    leaveTypeId: emergencyLeave.id,
    year: 2026,
    allocatedDays: 5,
    usedDays: 0
  });

  const leaveWorkflow = await seedDefaultLeaveWorkflow(ids.advancedTech);
  const seededLeave = await prisma.leaveRequest.upsert({
    where: { id: "00000000-0000-4000-8000-000000004101" },
    update: {
      leaveTypeId: annualLeave.id,
      requestNumber: "LR-00001",
      requestType: LeaveRequestType.LEAVE,
      leaveType: annualLeave.name,
      status: LeaveStatus.PENDING,
      startsAt: new Date("2026-07-14T00:00:00.000Z"),
      endsAt: new Date("2026-07-16T23:59:59.000Z"),
      durationType: LeaveDurationType.FULL_DAY,
      durationDays: 3,
      durationHours: null,
      halfDayPeriod: null,
      reason: "طلب إجازة سنوية مجدولة",
      deletedAt: null
    },
    create: {
      id: "00000000-0000-4000-8000-000000004101",
      companyId: ids.advancedTech,
      employeeId: ids.employee,
      departmentId: ids.hrDept,
      leaveTypeId: annualLeave.id,
      requestNumber: "LR-00001",
      requestType: LeaveRequestType.LEAVE,
      leaveType: annualLeave.name,
      startsAt: new Date("2026-07-14T00:00:00.000Z"),
      endsAt: new Date("2026-07-16T23:59:59.000Z"),
      durationType: LeaveDurationType.FULL_DAY,
      durationDays: 3,
      reason: "طلب إجازة سنوية مجدولة",
      status: LeaveStatus.PENDING
    }
  });
  await prisma.leaveRequest.upsert({
    where: { id: "00000000-0000-4000-8000-000000004102" },
    update: {
      leaveTypeId: sickLeave.id,
      requestNumber: "LR-00002",
      requestType: LeaveRequestType.LEAVE,
      leaveType: sickLeave.name,
      status: LeaveStatus.APPROVED,
      startsAt: new Date("2026-07-15T00:00:00.000Z"),
      endsAt: new Date("2026-07-15T23:59:59.000Z"),
      durationType: LeaveDurationType.FULL_DAY,
      durationDays: 1,
      durationHours: null,
      halfDayPeriod: null,
      reason: "إجازة مرضية معتمدة",
      approvedAt: new Date("2026-07-01T09:00:00.000Z"),
      rejectedAt: null,
      cancelledAt: null,
      deletedAt: null
    },
    create: {
      id: "00000000-0000-4000-8000-000000004102",
      companyId: ids.advancedTech,
      employeeId: ids.employee,
      departmentId: ids.hrDept,
      leaveTypeId: sickLeave.id,
      requestNumber: "LR-00002",
      requestType: LeaveRequestType.LEAVE,
      leaveType: sickLeave.name,
      startsAt: new Date("2026-07-15T00:00:00.000Z"),
      endsAt: new Date("2026-07-15T23:59:59.000Z"),
      durationType: LeaveDurationType.FULL_DAY,
      durationDays: 1,
      reason: "إجازة مرضية معتمدة",
      status: LeaveStatus.APPROVED,
      approvedAt: new Date("2026-07-01T09:00:00.000Z")
    }
  });
  const leaveSteps = await prisma.approvalStep.findMany({
    where: { companyId: ids.advancedTech, workflowId: leaveWorkflow.id, deletedAt: null },
    orderBy: { stepOrder: "asc" }
  });
  for (const step of leaveSteps) {
    const existingAction = await prisma.approvalAction.findFirst({
      where: {
        companyId: ids.advancedTech,
        workflowId: leaveWorkflow.id,
        stepId: step.id,
        entityType: EntityType.LEAVE_REQUEST,
        entityId: seededLeave.id,
        deletedAt: null
      }
    });

    if (!existingAction) {
      await prisma.approvalAction.create({
        data: {
          companyId: ids.advancedTech,
          workflowId: leaveWorkflow.id,
          stepId: step.id,
          entityType: EntityType.LEAVE_REQUEST,
          entityId: seededLeave.id
        }
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      companyId: ids.advancedTech,
      actorId: ids.companyAdmin,
      action: "seed.phase1",
      entityType: "system",
      metadata: { source: "prisma/seed.ts", phase: "foundation" }
    }
  });

  await prisma.activity.createMany({
    data: [
      {
        companyId: ids.advancedTech,
        actorId: ids.companyAdmin,
        type: "user.login",
        title: "Company admin account created",
        titleAr: "تم إنشاء حساب مدير الشركة",
        metadata: { email: "admin@company.com" }
      },
      {
        companyId: ids.advancedTech,
        actorId: ids.manager,
        type: "department.ready",
        title: "HR department configured",
        titleAr: "تم إعداد قسم الموارد البشرية",
        metadata: { code: "HR" }
      }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
