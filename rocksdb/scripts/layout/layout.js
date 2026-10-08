"use strict";
/*jslint browser: true, nomen: true*/
/*global $, define, d3, playback, tsld*/

/**
 * Draws the toy RocksDB in the same visual language as the Raft
 * visualization: steelblue for in-memory structures, white boxes with
 * black borders for on-disk files, Courier for data.
 */
define([], function () {
    var MESSAGE = {
            PUT:     {color: "black", size: 2, opacity: 1},
            GET:     {color: "dodgerblue", size: 2, opacity: 1},
            RESULT:  {color: "dodgerblue", size: 1.5, opacity: 0},
            FLUSH:   {color: "steelblue", size: 3, opacity: 1},
            COMPACT: {color: "purple", size: 3, opacity: 1},
            ADMIN:   {color: "#555", size: 2.5, opacity: 1},
        },
        HIGHLIGHT = {
            check:   {stroke: "orange", width: 4, dash: ""},
            hit:     {stroke: "green", width: 5, dash: ""},
            miss:    {stroke: "#999", width: 3, dash: "4,4"},
            bloom:   {stroke: "#999", width: 3, dash: "4,4"},
            input:   {stroke: "purple", width: 4, dash: "6,3"},
            new:     {stroke: "green", width: 4, dash: ""},
            "found-del": {stroke: "crimson", width: 5, dash: ""},
        },
        STYLE = {
            mem:        {fill: "steelblue", text: "white", sub: "#dde8f3", stroke: "steelblue"},
            imm:        {fill: "#9dbbd8", text: "#123", sub: "#234", stroke: "steelblue"},
            wal:        {fill: "white", text: "crimson", sub: "#777", stroke: "black"},
            sst:        {fill: "white", text: "black", sub: "#777", stroke: "black"},
            checkpoint: {fill: "#fafafa", text: "#333", sub: "#777", stroke: "#555", dash: "5,4"},
        };

    function Layout(selector) {
        tsld.Layout.call(this, selector);
    }

    Layout.prototype = new tsld.Layout();
    Layout.prototype.constructor = Layout;

    Layout.prototype.initialize = function () {
        var self = this;
        tsld.Layout.prototype.initialize.call(this);
        this.gLabels = this.g.append("g");
        this.gBoxes = this.g.append("g");
        this.gMessages = this.g.append("g");
        this.gClients = this.g.append("g");
        this.messages = {invalidate: function () { self.invalidateMessages(); }};
    };

    Layout.prototype.invalidate = function () {
        tsld.Layout.prototype.invalidate.call(this);
        if (!this.model()) {
            return;
        }
        this.invalidateLabels();
        this.invalidateBoxes();
        this.invalidateClients();
        this.invalidateMessages();
    };

    Layout.prototype.lineHeight = function () {
        return this.scales.font(5.6) * 1.25;
    };

    Layout.prototype.invalidateLabels = function () {
        var self = this,
            model = this.model(),
            labels = model.labels();

        labels.forEach(function (d) {
            model.anchors[d.id] = {x: self.scales.x(d.ax !== undefined ? d.ax : d.x), y: self.scales.y(d.y)};
        });

        this.gLabels.selectAll("text.label").data(labels, function (d) { return d.id; })
            .call(function () {
                this.enter().append("text")
                    .attr("class", "label")
                    .attr("font-family", "Courier New")
                    .attr("dominant-baseline", "middle")
                    .style("fill-opacity", 0);
                this.attr("x", function (d) { return self.scales.x(d.x); })
                    .attr("y", function (d) { return self.scales.y(d.y); })
                    .attr("text-anchor", function (d) { return d.anchor || "middle"; })
                    .attr("font-size", function (d) { return self.scales.font(d.size || 6); })
                    .attr("font-weight", function (d) { return d.size >= 6 ? "bold" : "normal"; })
                    .style("fill", function (d) { return d.color || "black"; })
                    .text(function (d) { return d.text; })
                    .transition().duration(500)
                    .style("fill-opacity", 1);
                this.exit().transition().duration(300).style("fill-opacity", 0).remove();
            });
    };

    Layout.prototype.invalidateBoxes = function () {
        var self = this,
            model = this.model(),
            boxes = model.boxes(),
            lh = this.lineHeight(),
            pad = lh * 0.35;

        // Compute pixel geometry and anchors.
        boxes.forEach(function (b) {
            var rows = b.lines.length + (b.title ? 1 : 0) + (b.sub ? 1 : 0);
            b.px = {
                x: self.scales.x(b.x),
                y: self.scales.y(b.y),
                w: self.scales.x(b.x + b.w) - self.scales.x(b.x),
                h: Math.max(rows, 1) * lh + pad * 2,
            };
            model.anchors[b.id] = {x: b.px.x + b.px.w / 2, y: b.px.y + b.px.h / 2};
        });

        this.gBoxes.selectAll("g.box").data(boxes, function (d) { return d.id; })
            .call(function () {
                var transform = function (d) { return "translate(" + d.px.x + "," + d.px.y + ")"; },
                    style = function (d) { return STYLE[d.kind]; },
                    hl = function (d) { return HIGHLIGHT[model.highlights[d.id]]; },
                    g = this.enter().append("g")
                        .attr("class", "box")
                        .attr("transform", transform)
                        .style("opacity", 0);
                g.append("rect").attr("rx", function (d) { return d.kind === "mem" || d.kind === "imm" ? 6 : 0; });
                g.append("text").attr("class", "lines")
                    .attr("font-family", "Courier New")
                    .attr("dominant-baseline", "middle");
                g.append("text").attr("class", "badge")
                    .attr("font-family", "Courier New")
                    .attr("font-weight", "bold")
                    .attr("text-anchor", "end");

                this.transition().duration(500)
                    .attr("transform", transform)
                    .style("opacity", 1);

                this.select("rect")
                    .transition().duration(500)
                    .attr("width", function (d) { return d.px.w; })
                    .attr("height", function (d) { return d.px.h; })
                    .style("fill", function (d) { return style(d).fill; })
                    .style("stroke", function (d) { return hl(d) ? hl(d).stroke : style(d).stroke; })
                    .style("stroke-width", function (d) { return hl(d) ? hl(d).width : 1.5; })
                    .style("stroke-dasharray", function (d) { return hl(d) ? hl(d).dash : (style(d).dash || ""); });

                this.select("text.badge")
                    .attr("x", function (d) { return d.px.w; })
                    .attr("y", -4)
                    .attr("font-size", self.scales.font(4.5))
                    .style("fill", function (d) { return hl(d) ? hl(d).stroke : "black"; })
                    .text(function (d) { return model.badges[d.id] || ""; });

                this.select("text.lines").each(function (d) {
                    var rows = [];
                    if (d.title) {
                        rows.push({t: d.title, c: style(d).text, w: "bold"});
                    }
                    if (d.sub) {
                        rows.push({t: d.sub, c: style(d).sub, w: "normal"});
                    }
                    d.lines.forEach(function (line) { rows.push({t: line, c: style(d).text, w: "normal"}); });
                    d3.select(this)
                        .attr("font-size", self.scales.font(5.6))
                        .selectAll("tspan").data(rows)
                        .call(function () {
                            this.enter().append("tspan");
                            this.attr("x", pad * 1.5)
                                .attr("y", function (r, i) { return pad + lh * (i + 0.5); })
                                .attr("font-weight", function (r) { return r.w; })
                                .style("fill", function (r) { return r.c; })
                                .text(function (r) { return r.t; });
                            this.exit().remove();
                        });
                });

                this.exit().transition().duration(500).style("opacity", 0).remove();
            });
    };

    Layout.prototype.invalidateClients = function () {
        var self = this,
            model = this.model(),
            clients = model.clients.toArray();

        clients.forEach(function (c, i) {
            c.x = 5;
            c.y = 10 + i * 16;
            c.r = 3.2;
            model.anchors[c.id] = {x: self.scales.x(c.x), y: self.scales.y(c.y)};
        });

        this.gClients.selectAll("g.client").data(clients, function (d) { return d.id; })
            .call(function () {
                var transform = function (d) { return "translate(" + self.scales.x(d.x) + "," + self.scales.y(d.y) + ")"; },
                    g = this.enter().append("g").attr("class", "client").attr("transform", transform);
                g.append("circle").attr("r", 0);
                g.append("text").attr("class", "value")
                    .attr("fill", "white")
                    .attr("dominant-baseline", "middle")
                    .attr("text-anchor", "middle");
                g.append("text").attr("class", "caption")
                    .attr("font-family", "Courier New")
                    .attr("dominant-baseline", "middle")
                    .attr("text-anchor", "middle");

                g = this.transition().duration(500).attr("transform", transform);
                g.select("circle")
                    .attr("r", function (d) { return self.scales.r(d.r); })
                    .style("fill", function (d) { return d.color; });
                g.select("text.value")
                    .attr("font-size", self.scales.font(5.5))
                    .text(function (d) { return d.value(); });
                g.select("text.caption")
                    .attr("y", function (d) { return self.scales.r(d.r) + self.scales.font(5); })
                    .attr("font-size", self.scales.font(4.5))
                    .text(function (d) { return d.caption || ""; });

                this.exit().transition().duration(500).style("opacity", 0).remove();
            });
    };

    Layout.prototype.invalidateMessages = function () {
        var self = this,
            model = this.model(),
            frame = this.current(),
            messages = model.messages.toArray();

        messages.forEach(function (m) {
            var s = model.anchors[m.source], t = model.anchors[m.target],
                pct = frame ? (frame.playhead() - m.sendTime) / (m.recvTime - m.sendTime) : 0,
                type = MESSAGE[m.type()] || MESSAGE.PUT;
            pct = Math.max(0, Math.min(1, pct));
            if (s && t) {
                m.x_px = s.x + (t.x - s.x) * pct;
                m.y_px = s.y + (t.y - s.y) * pct;
            }
            m.style = type;
        });

        this.gMessages.selectAll("circle.message").data(messages.filter(function (m) { return m.x_px !== undefined; }), function (d) { return d.id; })
            .call(function () {
                this.enter().append("circle").attr("class", "message").style("stroke-width", 2);
                this.attr("cx", function (d) { return d.x_px; })
                    .attr("cy", function (d) { return d.y_px; })
                    .attr("r", function (d) { return self.scales.r(d.style.size); })
                    .style("fill", function (d) { return d.style.color; })
                    .style("fill-opacity", function (d) { return d.style.opacity; })
                    .style("stroke", function (d) { return d.style.color; });
                this.exit().remove();
            });
    };

    return Layout;
});
