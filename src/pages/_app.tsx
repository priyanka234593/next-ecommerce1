// global styles
import "../assets/css/styles.scss";
import "swiper/swiper.scss";
import "rc-slider/assets/index.css";
import "react-rater/lib/react-rater.css";

// types
import type { AppProps } from "next/app";
import { Poppins } from "next/font/google";
import Router from "next/router";
import React from "react";

import { wrapper } from "../store";
import * as gtag from "../utils/gtag";

// ✅ Import your traffic report component
import TrafficReport from "../components/trafficreport/report";

const isProduction = process.env.NODE_ENV === "production";

// only events on production
if (isProduction) {
  Router.events.on("routeChangeComplete", (url: string) => gtag.pageview(url));
}

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--main-font",
});

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <React.StrictMode>
      {/* global font variable */}
      <style jsx global>{`
        :root {
          --main-font: ${poppins.style.fontFamily};
        }
      `}</style>

      {/* ✅ Traffic report script injected globally */}
      <TrafficReport />

      {/* ✅ Render actual app page */}
      <Component {...pageProps} />
    </React.StrictMode>
  );
}

// ✅ wrapper.withRedux still works
export default wrapper.withRedux(MyApp);
