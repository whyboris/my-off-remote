import { Component, OnInit, ChangeDetectionStrategy, inject, ChangeDetectorRef, model } from "@angular/core";
import { FormsModule } from '@angular/forms';

import { QrCodeComponent } from 'ng-qrcode';

import { defaultWindowIcon } from "@tauri-apps/api/app";
import { enable, isEnabled, disable } from '@tauri-apps/plugin-autostart';
import { exit } from '@tauri-apps/plugin-process';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getNetworkInfo } from 'tauri-plugin-device-info-api';
import { invoke } from "@tauri-apps/api/core";
import { listen, TauriEvent } from '@tauri-apps/api/event';
import { load } from '@tauri-apps/plugin-store';
import { Menu } from "@tauri-apps/api/menu";
import { moveWindow, Position } from "@tauri-apps/plugin-positioner";
import { TrayIcon } from '@tauri-apps/api/tray';

@Component({
  selector: "app-root",
  imports: [QrCodeComponent, FormsModule],
  templateUrl: "./app.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./app.component.css",
})
export class AppComponent implements OnInit {

  private cd = inject(ChangeDetectorRef);

  appWindow: any;
  store: any;

  port = model<number>(3000);

  uptime = "";
  ipAddress = "";

  constructor() { }

  ngOnInit() {
    this.setUpTray();
  }

  async exitApp() {
    await exit(0);
  }

  unlistenBlur: any;

  async setUpTray() {

    const menu = await Menu.new({
      items: [
        {
          id: 'quit',
          text: 'Quit',
          action: this.exitApp,
        },
      ],
    });

    const options: any = {
      menu,
      icon: await defaultWindowIcon(),
      action: (event: any) => {
        switch (event.type) {
          case 'Click':
            if (event.button === "Left" && event.buttonState === "Up") {
              this.restoreWindow();
            }
            break;
        }
      }
    };

    const tray = await TrayIcon.new(options);

    // console.log(tray);
    // this.enableAutostart();
    // this.handleSettings();
    this.startServer(this.port().toString());

    this.getUptime();

    this.appWindow = getCurrentWindow();

    this.moveWindowDownRight();

    await listen(TauriEvent.WINDOW_BLUR, (event) => {
      console.log('App lost focus');
      setTimeout(() => {
        this.minimizeWindow();
      }, 100); // helps with clicking on tray when window is open - reduces flicker
    });

    // setTimeout(() => {
    //   this.minimizeWindow();

      setTimeout(() => {
        this.restoreWindow();
      }, 2000);

    // }, 6000);

    const networkInfo = await getNetworkInfo();
    console.log("Local IP Address:", networkInfo.ipAddress);
    if (networkInfo.ipAddress) {
      this.ipAddress = networkInfo.ipAddress;
      this.cd.detectChanges();
    }
  }

  async moveWindowDownRight() {
    await moveWindow(Position.BottomRight);
  }

  async minimizeWindow() {
    // await this.appWindow.minimize();
    console.log('hiding');
    await this.appWindow.hide(); // minimizes to tray
  }

  async restoreWindow() {
    console.log('showing');
    await this.appWindow.show();
  }

  startServer(port: string) {
    invoke<string>("please_start_server", { port: parseInt(port, 10) }).then((text) => {
      console.log('server responded:', text);
    });
  }

  async enableAutostart() {
    // Enable autostart
    await enable();
    // Check enable state
    console.log(`registered for autostart? ${await isEnabled()}`);
    // Disable autostart
    disable();
  }

  async handleSettings() {
    const defaults = {
      'hi': 'hello world',
      'hihi': 'auto saved to store'
    };
    this.store = await load('store.json', { autoSave: true, defaults });
    const savedTheme = await this.store.get('theme');
    const hi = await this.store.get('hi');
    console.log('STORE:');
    console.log(savedTheme);
    console.log(hi);
  }

  getUptime(): void {
    invoke<string>("get_uptime").then((text) => {
      this.uptime = text;
    });
  }
}
