import { mount } from "svelte";
import "@fontsource/geist/latin-400.css";
import "@fontsource/geist/latin-600.css";
import "../app.css";
import ShotPopup from "./ShotPopup.svelte";

mount(ShotPopup, { target: document.getElementById("app")! });
