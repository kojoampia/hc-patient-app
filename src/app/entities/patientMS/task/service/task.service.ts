/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/entities/patientMS/task/service/task.service.ts @ 12e418c
 * Divergence: constructor parameter properties replaced with inject(), and the injected fields
 *   declared ABOVE `resourceUrl`, which reads one of them. The generated form initialises a
 *   field from a constructor parameter property, which only works when TypeScript downlevels
 *   class fields; under native ES2022 semantics the initialiser runs first and the service is
 *   constructed with an undefined config. This form is correct under both. It is the same
 *   ordering hazard the @typescript-eslint/member-ordering rule's comment describes.
 * Re-sync: see PROVENANCE.md.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

import { map } from 'rxjs/operators';

import dayjs from 'dayjs/esm';

import { isPresent } from 'app/core/util/operators';
import { DATE_FORMAT } from 'app/config/input.constants';
import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { createRequestOption } from 'app/core/request/request-util';
import { ITask, NewTask } from '../task.model';

export type PartialUpdateTask = Partial<ITask> & Pick<ITask, 'id'>;

type RestOf<T extends ITask | NewTask> = Omit<T, 'schedule' | 'scheduledAt' | 'createdDate' | 'modifiedDate'> & {
  schedule?: string | null;
  scheduledAt?: string | null;
  createdDate?: string | null;
  modifiedDate?: string | null;
};

export type RestTask = RestOf<ITask>;

export type NewRestTask = RestOf<NewTask>;

export type PartialUpdateRestTask = RestOf<PartialUpdateTask>;

export type EntityResponseType = HttpResponse<ITask>;
export type EntityArrayResponseType = HttpResponse<ITask[]>;

@Injectable({ providedIn: 'root' })
export class TaskService {
  protected http = inject(HttpClient);
  protected applicationConfigService = inject(ApplicationConfigService);

  protected resourceUrl = this.applicationConfigService.getEndpointFor('api/tasks', 'hcpatientservice');


  create(task: NewTask): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(task);
    return this.http.post<RestTask>(this.resourceUrl, copy, { observe: 'response' }).pipe(map(res => this.convertResponseFromServer(res)));
  }

  update(task: ITask): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(task);
    return this.http
      .put<RestTask>(`${this.resourceUrl}/${this.getTaskIdentifier(task)}`, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  partialUpdate(task: PartialUpdateTask): Observable<EntityResponseType> {
    const copy = this.convertDateFromClient(task);
    return this.http
      .patch<RestTask>(`${this.resourceUrl}/${this.getTaskIdentifier(task)}`, copy, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  find(id: string): Observable<EntityResponseType> {
    return this.http
      .get<RestTask>(`${this.resourceUrl}/${id}`, { observe: 'response' })
      .pipe(map(res => this.convertResponseFromServer(res)));
  }

  query(req?: any): Observable<EntityArrayResponseType> {
    const options = createRequestOption(req);
    return this.http
      .get<RestTask[]>(this.resourceUrl, { params: options, observe: 'response' })
      .pipe(map(res => this.convertResponseArrayFromServer(res)));
  }

  delete(id: string): Observable<HttpResponse<{}>> {
    return this.http.delete(`${this.resourceUrl}/${id}`, { observe: 'response' });
  }

  getTaskIdentifier(task: Pick<ITask, 'id'>): string {
    return task.id;
  }

  compareTask(o1: Pick<ITask, 'id'> | null, o2: Pick<ITask, 'id'> | null): boolean {
    return o1 && o2 ? this.getTaskIdentifier(o1) === this.getTaskIdentifier(o2) : o1 === o2;
  }

  addTaskToCollectionIfMissing<Type extends Pick<ITask, 'id'>>(
    taskCollection: Type[],
    ...tasksToCheck: (Type | null | undefined)[]
  ): Type[] {
    const tasks: Type[] = tasksToCheck.filter(isPresent);
    if (tasks.length > 0) {
      const taskCollectionIdentifiers = taskCollection.map(taskItem => this.getTaskIdentifier(taskItem)!);
      const tasksToAdd = tasks.filter(taskItem => {
        const taskIdentifier = this.getTaskIdentifier(taskItem);
        if (taskCollectionIdentifiers.includes(taskIdentifier)) {
          return false;
        }
        taskCollectionIdentifiers.push(taskIdentifier);
        return true;
      });
      return [...tasksToAdd, ...taskCollection];
    }
    return taskCollection;
  }

  protected convertDateFromClient<T extends ITask | NewTask | PartialUpdateTask>(task: T): RestOf<T> {
    return {
      ...task,
      schedule: task.schedule?.format(DATE_FORMAT) ?? null,
      scheduledAt: task.scheduledAt?.toJSON() ?? null,
      createdDate: task.createdDate?.format(DATE_FORMAT) ?? null,
      modifiedDate: task.modifiedDate?.format(DATE_FORMAT) ?? null,
    };
  }

  protected convertDateFromServer(restTask: RestTask): ITask {
    return {
      ...restTask,
      schedule: restTask.schedule ? dayjs(restTask.schedule) : undefined,
      scheduledAt: restTask.scheduledAt ? dayjs(restTask.scheduledAt) : undefined,
      createdDate: restTask.createdDate ? dayjs(restTask.createdDate) : undefined,
      modifiedDate: restTask.modifiedDate ? dayjs(restTask.modifiedDate) : undefined,
    };
  }

  protected convertResponseFromServer(res: HttpResponse<RestTask>): HttpResponse<ITask> {
    return res.clone({
      body: res.body ? this.convertDateFromServer(res.body) : null,
    });
  }

  protected convertResponseArrayFromServer(res: HttpResponse<RestTask[]>): HttpResponse<ITask[]> {
    return res.clone({
      body: res.body ? res.body.map(item => this.convertDateFromServer(item)) : null,
    });
  }
}
