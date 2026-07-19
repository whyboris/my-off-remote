import { Component, OnInit, ChangeDetectionStrategy } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { QrCodeComponent } from 'ng-qrcode';

import { defaultWindowIcon } from "@tauri-apps/api/app";
import { enable, isEnabled, disable } from '@tauri-apps/plugin-autostart';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getNetworkInfo } from 'tauri-plugin-device-info-api';
import { invoke } from "@tauri-apps/api/core";
import { load } from '@tauri-apps/plugin-store';
import { Menu } from "@tauri-apps/api/menu";
import { moveWindow, Position } from "@tauri-apps/plugin-positioner";
import { TrayIcon } from '@tauri-apps/api/tray';

@Component({
  selector: "app-root",
  imports: [RouterOutlet, QrCodeComponent],
  templateUrl: "./app.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./app.component.css",
})
export class AppComponent implements OnInit {

  appWindow: any;

  store: any;

  greetingMessage = "";

  ipAddress = "";
  port = 3000;

  constructor() { }

  ngOnInit() {
    this.setUpTray();
  }

  async setUpTray() {

    const menu = await Menu.new({
      items: [
        {
          id: 'quit',
          text: 'Quit',
        },
      ],
    });

    const options: any = {
      menu,
      icon: await defaultWindowIcon(),
      menuOnLeftClick: true,
    };

    const tray = await TrayIcon.new(options);

    // console.log(tray);
    // this.enableAutostart();
    // this.handleSettings();
    this.startServer();

    this.appWindow = getCurrentWindow();

    this.moveWindowDownRight();

    setTimeout(() => {
      this.minimizeWindow();

      setTimeout(() => {
        this.restoreWindow();
      }, 3000);

    }, 6000);

    const networkInfo = await getNetworkInfo();
    console.log("Local IP Address:", networkInfo.ipAddress);
    if (networkInfo.ipAddress) {
      this.ipAddress = networkInfo.ipAddress;
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

  startServer() {

    const payload = "lol";
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    invoke<string>("please_start_server", { payload }).then((text) => {
      this.greetingMessage = text;
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

  greet(event: SubmitEvent, name: string): void {
    event.preventDefault();

    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    invoke<string>("greet", { name }).then((text) => {
      this.greetingMessage = text;
    });
  }
}
