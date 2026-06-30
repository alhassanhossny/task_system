import { Injectable } from "@nestjs/common";
import { Observable, Subject } from "rxjs";
import { DomainEvent, PublishDomainEventInput } from "./domain-event";

@Injectable()
export class DomainEventBus {
  private readonly eventSubject = new Subject<DomainEvent>();

  get events$(): Observable<DomainEvent> {
    return this.eventSubject.asObservable();
  }

  publish(event: PublishDomainEventInput) {
    this.eventSubject.next({
      ...event,
      occurredAt: event.occurredAt ?? new Date()
    });
  }
}
