import { ChangeDetectionStrategy, Component, model, OnInit, signal } from "@angular/core";
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {

  appWindow: any;
  store: any;

  port = model<number>(3000);
  autostart = signal<boolean>(true);
  ipAddress = signal<string>("192.168.X.X");
  portTaken = signal<boolean>(false);
  serverRunning = signal<boolean>(false);

  uptime = 0; // unused

  constructor() { }

  ngOnInit() {
    this.setUpTray();
  }

  async setUpTray() {
    const menu = await Menu.new({ items: [{ id: 'quit', text: 'Quit', action: this.exitApp }] });

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

    // handle below better
    // this.enableAutostart();
    // this.handleSettings();
    // this.startServer(this.port());
    // this.getUptime();

    // setTimeout(() => {
    //   this.restoreWindow();
    // }, 2000);
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

    this.serverRunning.set(true);
  }

  async stopServer() {
    this.portTaken.set(false);

    if (this.serverRunning()) {
      await this.requestServerShutdown();
      this.serverRunning.set(false);
    }
  }

  /**
   * Makes POST request to `/off` endpoint to initiate server shutdown
   */
  async requestServerShutdown() {
    const url = "http://" + this.ipAddress() + ':' + this.port() + '/off';

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

  // Utility functions

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

  toggleAutostart() {
    console.log('AUTOSTART toggle does nothing currently');
    this.autostart.update(current => !current);
  }

  async enableAutostart() {
    console.log('AUTOSTART NOT IMPLEMENTED');
    // Enable autostart
    await enable();
    // Check enable state
    console.log(`registered for autostart? ${await isEnabled()}`);
    // Disable autostart
    disable();
  }

  copyToClipboard(): void {
    navigator.clipboard.writeText("http://" + this.ipAddress() + ":" + this.port());
  }

  // Window interactions

  async moveWindowDownRight() {
    await moveWindow(Position.BottomRight);
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
    await exit(0);
  }
}
