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
  styleUrl: "./app.component.scss",
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class AppComponent implements OnInit {

  private cd = inject(ChangeDetectorRef);

  appWindow: any;
  store: any;

  port = model<number>(3000);

  ipAddress = "192.168.X.X";
  uptime = 0;

  portTaken = false;
  autostart = true;
  serverRunning = false;

  constructor() { }

  ngOnInit() {
    this.setUpTray();
  }

  async exitApp() {
    await exit(0);
  }

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
    // this.startServer(this.port());

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

  /**
   * Makes POST request to `/off` endpoint to initiate server shutdown
   */
  async requestServerShutdown() {
    const url = "http://" + this.ipAddress + ':' + this.port() + '/off';

    console.log(url);

    try {
      const response = await fetch(url, { method: 'post' });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      console.log('Success!', response);

    } catch (error) {
      console.error('Native fetch failed:', error);
    }
  }

  async minimizeWindow() {
    // await this.appWindow.minimize();
    console.log('hiding');
    // next line disabled for dev:
    // await this.appWindow.hide(); // minimizes to tray
  }

  async restoreWindow() {
    console.log('showing');
    await this.appWindow.show();
  }

  async startServer(port: number) {

    console.log('starting on port', port);

    if (port < 1025 || port > 65500) {
      this.port.set(3000);
    }

    // do not `await` since text returns only when server errors out
    invoke<string>("please_start_server", { port }).then((text) => {
      if (text) {
        // text returns on error (port taken) or after shut down (return string after axum::serve)
        console.log(text);
        setTimeout(() => {
          if (text !== "server is off") { // hardcoded on back end, do not change either
            this.portTaken = true;
          }
          this.serverRunning = false;
          this.cd.detectChanges();
        }, 5);
      }
    })

    this.serverRunning = true;
  }

  async stopServer() {

    this.portTaken = false;

    if (this.serverRunning) {

      await this.requestServerShutdown();

      this.serverRunning = false;
    }
  }

  toggleServer() {
    if (this.serverRunning) {
      console.log('stopping');
      this.stopServer();
    } else {
      console.log('starting');
      this.startServer(this.port());
    }

    // console.log('toggling...');
    // this.serverRunning = !this.serverRunning;
  }

  toggleAutostart() {
    this.autostart = !this.autostart;
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

  async getUptime() {
    await invoke<number>("get_uptime").then((duration) => {
      this.uptime = duration;
    });
  }
}
