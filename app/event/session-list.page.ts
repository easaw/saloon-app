import {OnInit} from "angular2/core";
import {Page} from "ionic-angular";
import {NavController} from "ionic-angular/index";
import * as _ from "lodash";
import {EventFull} from "./models/EventFull";
import {EventItem} from "./models/EventItem";
import {SessionFull} from "./models/SessionFull";
import {EventService} from "./services/event.service";
import {Filter, Sort} from "../common/utils/array";
import {WeekDayPipe, TimePipe, TimePeriodPipe} from "../common/pipes/datetime.pipe";
import {CapitalizePipe} from "../common/pipes/text.pipe";
import {UiUtils} from "../common/ui/utils";
import {SessionPage} from "./session.page";
import {EventData} from "./services/event.data";

@Page({
    styles: [`
.item h2, .item p {
    white-space: initial;
}
    `],
    template: `
<ion-navbar *navbar>
    <ion-title>{{eventItem.name}}</ion-title>
</ion-navbar>
<ion-toolbar>
    <ion-searchbar [(ngModel)]="searchQuery" (input)="search()" debounce="500"></ion-searchbar>
</ion-toolbar>
<ion-content class="session-list-page">
    <ion-refresher (refresh)="doRefresh($event)"></ion-refresher>
    <div *ngIf="!eventFull" style="text-align: center; margin-top: 100px;"><ion-spinner></ion-spinner></div>
    <ion-list-header *ngIf="eventFull && filtered.length === 0">Pas de session trouvée</ion-list-header>
    <ion-list *ngIf="eventFull && filtered.length > 0">
        <ion-item-group *ngFor="#group of filtered">
            <ion-item-divider sticky>{{group.title}}</ion-item-divider>
            <ion-item *ngFor="#session of group.items" (click)="goToSession(session)">
                <h2>{{session.name}}</h2>
                <p>{{[session.place, session.category, session.start | timePeriod:session.end].filter(notEmpty).join(' - ')}}</p>
                <p>{{session.speakers.map(toName).join(', ')}}</p>
                <button clear item-right (click)="toggleFav(session);$event.stopPropagation();">
                    <ion-icon name="star" [hidden]="!isFav(session)"></ion-icon>
                    <ion-icon name="star-outline" [hidden]="isFav(session)"></ion-icon>
                </button>
            </ion-item>
        </ion-item-group>
    </ion-list>
</ion-content>
`,
    pipes: [TimePeriodPipe]
})
export class SessionListPage implements OnInit {
    searchQuery: string = '';
    eventItem: EventItem;
    eventFull: EventFull;
    filtered: Array<any> = [];
    constructor(private _nav: NavController,
                private _eventService: EventService,
                private _eventData: EventData,
                private _weekDayPipe: WeekDayPipe,
                private _timePipe: TimePipe,
                private _capitalizePipe: CapitalizePipe,
                private _uiUtils: UiUtils) {}

    ngOnInit() {
        this.eventItem = this._eventData.getCurrentEventItem();
        setTimeout(() => {
            this._eventData.getCurrentEventFull().then(event => {
                this.eventFull = event;
                this.filtered = this.compute(this.eventFull.sessions, this.searchQuery);
            });
        }, 600);
    }

    doRefresh(refresher) {
        this._eventService.fetchEvent(this.eventItem.uuid).then(
            eventFull => {
                this.eventItem = EventFull.toItem(eventFull);
                this.eventFull = eventFull;
                this.filtered = this.compute(this.eventFull.sessions, this.searchQuery);
                this._eventData.updateCurrentEvent(this.eventItem, this.eventFull);
                refresher.complete();
            },
            error => {
                this._uiUtils.alert(this._nav, 'Fail to update :(');
                refresher.complete();
            }
        );
    }

    search() {
        this.filtered = this.compute(this.eventFull.sessions, this.searchQuery);
    }

    compute(items: SessionFull[], q: string): Array<any> {
        const that = this;
        function filter(items: SessionFull[], q: string): SessionFull[] {
            return q.trim() === '' ? items : items.filter(item => Filter.deep(item, q));
        }
        function group(items: SessionFull[]): Array<any> {
            const grouped = _.groupBy(items, 'start');
            const ret = [];
            for(let key in grouped){
                const time = parseInt(key, 10);
                ret.push({
                    title: that._capitalizePipe.transform(that._weekDayPipe.transform(time))+', '+that._timePipe.transform(time),
                    time: time,
                    items: grouped[key]
                });
            }
            return ret.sort((e1, e2) => Sort.num(e1.time, e2.time));
        }
        return group(filter(items, q));
    }

    isFav(sessionFull: SessionFull) {
        return this._eventData.isFavoriteSession(sessionFull);
    }

    toggleFav(sessionFull: SessionFull) {
        if(this.isFav(sessionFull)){
            this._eventData.unfavoriteSession(SessionFull.toItem(sessionFull));
        } else {
            this._eventData.favoriteSession(SessionFull.toItem(sessionFull));
        }
    }

    goToSession(sessionFull: SessionFull) {
        this._nav.push(SessionPage, {
            sessionItem: SessionFull.toItem(sessionFull)
        });
    }

    notEmpty(e: string): boolean {
        return e ? e.length > 0 : false;
    }
    toName(e: any): string {
        return e.name;
    }
}
