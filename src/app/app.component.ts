import { Component, OnInit } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { defaultWindowIcon } from "@tauri-apps/api/app";
import { enable, isEnabled, disable } from '@tauri-apps/plugin-autostart';
import { invoke } from "@tauri-apps/api/core";
import { load } from '@tauri-apps/plugin-store';
import { Menu } from "@tauri-apps/api/menu";
import { TrayIcon } from '@tauri-apps/api/tray';

@Component({
  selector: "app-root",
  imports: [RouterOutlet],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent implements OnInit {

  store: any;

  greetingMessage = "";

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

    console.log(tray);

    // this.enableAutostart();
    this.handleSettings();
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
