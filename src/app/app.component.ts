import { ChangeDetectionStrategy, Component, model, OnInit, signal } from "@angular/core";
import { FormsModule } from '@angular/forms';

import { QrCodeComponent } from 'ng-qrcode';

import { defaultWindowIcon } from "@tauri-apps/api/app";
import { emit, listen, TauriEvent } from '@tauri-apps/api/event';
import { enable, disable } from '@tauri-apps/plugin-autostart';
import { exit } from '@tauri-apps/plugin-process';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getNetworkInfo } from 'tauri-plugin-device-info-api';
import { invoke } from "@tauri-apps/api/core";
import { load } from '@tauri-apps/plugin-store';
import { Menu } from "@tauri-apps/api/menu";
import { moveWindow, Position } from "@tauri-apps/plugin-positioner";
import { platform } from '@tauri-apps/plugin-os';
import { TrayIcon } from '@tauri-apps/api/tray';

@Component({
  selector: "app-root",
  imports: [QrCodeComponent, FormsModule],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {

  appWindow: any;
  store: any;
  currentPlatform = platform();

  port = model<number>(3000);
  autostart = signal<boolean>(true);
  ipAddress = signal<string>("192.168.X.X");
  portTaken = signal<boolean>(false);
  serverRunning = signal<boolean>(false);

  lastRunningServerUrl = "";

  uptime = 0; // unused

  constructor() { }

  ngOnInit() {
    this.setUpTray();
  }

  async setUpTray() {
    const menu = await Menu.new({ items: [{ id: 'quit', text: 'Quit', action: async () => { await emit('quit-request')} }] });

    const options: any = {
      menu,
      icon: await defaultWindowIcon(),
      action: (event: any) => {
        switch (event.type) {
          case 'Click':
            if (this.currentPlatform === 'macos') {
              if (event.button === "Left" && event.buttonState === "Down") {
                // mac doesn't have the "Up" state?!??
                this.restoreWindow();
              }
            } else {
              if (event.button === "Left" && event.buttonState === "Up") {
                this.restoreWindow();
              }
            }
            break;
        }
      }
    };

    await TrayIcon.new(options);

    this.appWindow = getCurrentWindow();
    this.moveWindowDownRight(); // TODO: handle Mac OS with move UP & RIGHT

    await listen(TauriEvent.WINDOW_BLUR, (event) => {
      console.log('App lost focus, minimizing');
      setTimeout(() => {
        this.minimizeWindow();
      }, 100); // helps with clicking on tray when window is open - reduces flicker
    });

    const networkInfo = await getNetworkInfo();
    console.log("Local IP Address:", networkInfo.ipAddress);
    if (networkInfo.ipAddress) {
      this.ipAddress.set(networkInfo.ipAddress);
    }

    this.handleSettings();

    await listen('quit-request', (event) => {
      this.exitApp();
    });
  }

  // Server interactions

  toggleServer() {
    if (this.serverRunning()) {
      console.log('stopping');
      this.stopServer();
    } else {
      console.log('starting');
      this.startServer(this.port());
    }

    // console.log('toggling...');
    // this.serverRunning() = !this.serverRunning();
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
          if (text !== "server is off") { // hardcoded on back end, update both if changing
            this.portTaken.set(true);
          }
          this.serverRunning.set(false);
        }, 5);
      }
    })

    this.lastRunningServerUrl = 'http://' + this.ipAddress() + ':' + this.port();
    this.serverRunning.set(true);
  }

  async stopServer() {
    this.portTaken.set(false);

    if (this.serverRunning()) {
      this.serverRunning.set(false);
      await this.requestServerShutdown();
    }
  }

  /**
   * Makes POST request to `/off` endpoint to initiate server shutdown
   */
  async requestServerShutdown() {
    const url = this.lastRunningServerUrl + '/off';

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

  // Utility functions

  async handleSettings() {
    const defaults = {
      'autostart': false,
      'port': 3000
    };
    this.store = await load('store.json', { autoSave: true, defaults });

    const autostart: boolean = await this.store.get('autostart');
    const port: number = await this.store.get('port');

    this.autostart.set(autostart);
    this.port.set(port)

    if (autostart) {
      this.startServer(port);
    }
  }

  async toggleAutostart() {
    this.autostart.update(current => !current);

    await this.store.set('autostart', this.autostart());

    if (this.autostart()) {
      await enable();
    } else {
      disable();
    }

    console.log("store autostart:", await this.store.get('autostart'));
  }

  copyToClipboard(): void {
    navigator.clipboard.writeText("http://" + this.ipAddress() + ":" + this.port());
  }

  // Window interactions

  async moveWindowDownRight() {
    if (this.currentPlatform === "windows") {
      await moveWindow(Position.BottomRight);
    } else {
      await moveWindow(Position.TopRight);
    }
  }

  async minimizeWindow() {
    await this.appWindow.hide();
  }

  async restoreWindow() {
    await this.appWindow.show();
  }

  // Misc

  // uptime not used. Note: there is a pipe that pretty-prints the number
  async getUptime() {
    await invoke<number>("get_uptime").then((duration) => {
      this.uptime = duration;
    });
  }

  async exitApp() {
    await this.store.set('port', this.port());
    await exit(0);
  }
}
