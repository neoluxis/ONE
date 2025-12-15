import { getSingBoxConfig } from "../internal/Converter/getSingBoxConfig.ts";
import getParsedSubData from "../internal/getParsedSubData.ts";

export async function onRequest (context) {
    const { request } = context;
    const URLObject = new URL(request.url);
    let { Proxies } = await getParsedSubData(
        URLObject.searchParams.get("url"), 
        context.env.EdgeSubDB, 
        URLObject.searchParams.get("show_host") === "true",
        JSON.parse(URLObject.searchParams.get("http_headers")),
    );

    // filter proxies by regex pattern if provided. pattern uses pipe-separated alternatives (e.g., pattern1|pattern2)
    const filterKeywordRaw = URLObject.searchParams.get("filter_keyword") || "";
    if (filterKeywordRaw.trim().length > 0) {
        try {
            const filterRegex = new RegExp(filterKeywordRaw, "i"); // case-insensitive regex
            Proxies = Proxies.filter(p => {
                try {
                    const name = (p.__Remark || "").toString();
                    const source = (p.__Source || "").toString();
                    const host = ((p.Hostname || "") + ":" + (p.Port || "")).toString();
                    // exclude if any field matches the regex pattern
                    if (filterRegex.test(name) || filterRegex.test(source) || filterRegex.test(host)) {
                        return false; // exclude this proxy
                    }
                } catch (e) {
                    return true;
                }
                return true;
            })
        } catch (e) {
            console.warn("[sing-box filter] Invalid regex pattern:", filterKeywordRaw, e);
            // if regex is invalid, keep all proxies
        }
    }

    // a javascript object !!! not YAML !!!
    let SingBoxConfigObject = await getSingBoxConfig (
        Proxies,
        context.env.EdgeSubDB,
        {
            isUDP: URLObject.searchParams.get("udp") === "true",
            isSSUoT: URLObject.searchParams.get("ss_uot") === "true",
            isInsecure: true,
            RuleProvider: URLObject.searchParams.get("remote_config") || "__DEFAULT",
            RuleProvidersProxy: URLObject.searchParams.get("rule_providers_proxy"),
            isForcedRefresh: URLObject.searchParams.get("forced_refresh") === "true" ? true : false
        }
    )

    // handle forced ws 0-rtt
    if (URLObject.searchParams.get("forced_ws0rtt") === "true") {
        console.info("[Main] ForcedWS0RTT enabled.")
        for (let i of SingBoxConfigObject.outbounds) {
            if (!("transport" in i)) {
                continue;
            }
            if (i.transport.type !== "ws") {
                continue;
            }
            i.transport.max_early_data = 2560
            i.transport.early_data_header_name = "Sec-WebSocket-Protocol"
        }
    }

    const ResponseBody = JSON.stringify(SingBoxConfigObject)

    return new Response(ResponseBody, {
        status: 200,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Length": ResponseBody.length,
        }
    })
}