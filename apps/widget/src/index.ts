import { init } from "./loader";

// `document.currentScript` n'est valable que pendant l'exécution synchrone du script.
void init(document.currentScript as HTMLScriptElement | null);
