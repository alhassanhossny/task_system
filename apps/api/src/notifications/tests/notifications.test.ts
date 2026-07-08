import { NotificationType, UserStatus } from "@prisma/client";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications.service";

const prisma = new PrismaService();

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const notificationsService = new NotificationsService(prisma);

  const company = await prisma.company.create({
    data: {
      name: `Notifications Tenant ${suffix}`,
      slug: `notifications-tenant-${suffix}`
    }
  });

  try {
    const [user, otherUser] = await Promise.all([
      prisma.user.create({
        data: {
          companyId: company.id,
          email: `notifications-user-${suffix}@example.com`,
          passwordHash: "test",
          name: "Notifications User",
          status: UserStatus.ACTIVE
        }
      }),
      prisma.user.create({
        data: {
          companyId: company.id,
          email: `notifications-other-${suffix}@example.com`,
          passwordHash: "test",
          name: "Other Notifications User",
          status: UserStatus.ACTIVE
        }
      })
    ]);

    await notificationsService.create(company.id, {
      userId: user.id,
      type: NotificationType.TASK_ASSIGNED,
      title: "Task assigned",
      message: "A task was assigned to you."
    });
    await notificationsService.create(company.id, {
      userId: user.id,
      type: NotificationType.LEAVE_APPROVED,
      title: "Leave approved",
      message: "Your leave request was approved."
    });
    const otherNotification = await notificationsService.create(company.id, {
      userId: otherUser.id,
      type: NotificationType.EMAIL_SENT,
      title: "Email sent",
      message: "An email was sent."
    });

    const unreadBefore = await notificationsService.findForUser(company.id, user.id, { unreadOnly: true });
    assert.equal(unreadBefore.length, 2);

    const result = await notificationsService.markAllRead(company.id, user.id);
    assert.equal(result.updated, 2);

    const unreadAfter = await notificationsService.findForUser(company.id, user.id, { unreadOnly: true });
    assert.equal(unreadAfter.length, 0);

    const otherUsersNotification = await prisma.notification.findUniqueOrThrow({
      where: { id: otherNotification.id }
    });
    assert.equal(otherUsersNotification.isRead, false, "mark all read must not update another user's notifications");

    const newNotification = await notificationsService.create(company.id, {
      userId: user.id,
      type: NotificationType.TASK_COMPLETED,
      title: "Task completed",
      message: "A watched task was completed."
    });

    const readNotification = await notificationsService.markRead(company.id, user.id, newNotification.id);
    assert.equal(readNotification.isRead, true);
    assert.ok(readNotification.readAt);

    console.log("Notification assertions passed for list, mark all read, single read, and per-user isolation.");
  } finally {
    await prisma.notification.deleteMany({ where: { companyId: company.id } });
    await prisma.user.deleteMany({ where: { companyId: company.id } });
    await prisma.company.deleteMany({ where: { id: company.id } });
    await prisma.$disconnect();
  }
}

void main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
