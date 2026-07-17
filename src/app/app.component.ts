import { Component, OnInit } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { defaultWindowIcon } from "@tauri-apps/api/app";
import { enable, isEnabled, disable } from '@tauri-apps/plugin-autostart';
import { invoke } from "@tauri-apps/api/core";
import { Menu } from "@tauri-apps/api/menu";
import { TrayIcon } from '@tauri-apps/api/tray';

@Component({
  selector: "app-root",
  imports: [RouterOutlet],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent implements OnInit {
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
  }

  async enableAutostart() {
    // Enable autostart
    await enable();
    // Check enable state
    console.log(`registered for autostart? ${await isEnabled()}`);
    // Disable autostart
    disable();
  }

  greet(event: SubmitEvent, name: string): void {
    event.preventDefault();

    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    invoke<string>("greet", { name }).then((text) => {
      this.greetingMessage = text;
    });
  }
}
