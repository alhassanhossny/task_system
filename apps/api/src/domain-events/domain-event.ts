import { EntityType } from "@prisma/client";

export interface DomainEvent {
  name: string;
  companyId: string;
  actorId?: string | null;
  entityType?: EntityType | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  occurredAt: Date;
}

export type PublishDomainEventInput = Omit<DomainEvent, "occurredAt"> & {
  occurredAt?: Date;
};
