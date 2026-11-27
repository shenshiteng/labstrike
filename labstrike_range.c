/*
 * LabStrike 靶场模拟器 (labstrike_range.c)
 * 纯 C99 命令行程序，无第三方依赖，gcc 可直接编译运行。
 *
 * 编译: gcc -std=c99 -O2 labstrike_range.c -o labstrike_range -lm
 * 运行: ./labstrike_range            交互模式
 *       ./labstrike_range demo       自动演示
 *       ./labstrike_range --help     查看帮助
 *
 * 这是 LabStrike 项目的 C 语言命令行版本：复用同一套武器弹药规则、
 * 5 种靶场任务和命中判定规则，可在没有任何浏览器/图形环境的情况下运行。
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_TARGETS 6

typedef struct {
    const char *name;
    int mag;
    int reserve;
    double spread;
} Weapon;

static const Weapon WEAPONS[] = {
    { "Pistol",       10,  60, 0.35 },
    { "Glock",        12,  72, 0.30 },
    { "AssaultRifle", 45, 180, 0.42 },
    { "Shotgun",       6,  36, 0.90 }
};
#define NWEAPONS ((int)(sizeof(WEAPONS) / sizeof(WEAPONS[0])))

typedef struct {
    const char *name;
    int count;
    int limit;   /* 0 表示不限时 */
    int moving;
    int head;
    int order;
} Mission;

static const Mission MISSIONS[] = {
    { "Timed Hit",      5, 30, 0, 0, 0 },
    { "Moving Targets", 5,  0, 1, 0, 0 },
    { "Headshot",       3, 25, 0, 1, 0 },
    { "Sequence",       4, 40, 0, 0, 1 },
    { "Combo",          6, 45, 1, 1, 1 }
};
#define NMISSIONS ((int)(sizeof(MISSIONS) / sizeof(MISSIONS[0])))

typedef struct {
    int id;
    double x, z;
    double base_x, base_z;
    int alive;
    double phase;
} Target;

typedef struct {
    int wi;
    int mag, reserve;
    int mission;
    int hit, total, seq, score, shots;
    double time;
    int ntargets;
    Target targets[MAX_TARGETS];
} Game;

/* 固定种子的简易随机数：任务布局可复现，方便验收 */
static unsigned long rng_state = 20261127UL;
static double rnd(void) {
    rng_state = rng_state * 1103515245UL + 12345UL;
    return (double)(rng_state & 0x7fffffffUL) / (double)0x7fffffffUL;
}

static void init_game(Game *g) {
    memset(g, 0, sizeof(*g));
    g->wi = 0;
    g->mag = WEAPONS[0].mag;
    g->reserve = WEAPONS[0].reserve;
    g->mission = -1;
}

static void start_mission(Game *g, int idx) {
    int i;
    const Mission *m;
    if (idx < 0 || idx >= NMISSIONS) {
        printf("没有这个任务（1~%d）\n", NMISSIONS);
        return;
    }
    m = &MISSIONS[idx];
    g->mission = idx;
    g->hit = 0;
    g->seq = 0;
    g->time = 0;
    g->total = m->count;
    g->ntargets = m->count;
    if (g->ntargets > MAX_TARGETS) g->ntargets = MAX_TARGETS;
    rng_state = 20261127UL + (unsigned long)idx * 7919UL;
    for (i = 0; i < g->ntargets; i++) {
        Target *t = &g->targets[i];
        t->id = i;
        t->base_x = -6.0 + 12.0 * rnd();
        t->base_z = -5.0 + 10.0 * rnd();
        t->x = t->base_x;
        t->z = t->base_z;
        t->alive = 1;
        t->phase = rnd() * 6.2831853;
    }
    printf("[任务] %s：%d 个靶", m->name, g->total);
    if (m->limit) printf("，限时 %d 秒", m->limit);
    if (m->moving) printf("，移动靶");
    if (m->head) printf("，需爆头");
    if (m->order) printf("，按编号顺序");
    printf("。\n");
}

static void update_targets(Game *g, double dt) {
    int i;
    const Mission *m;
    if (g->mission < 0) return;
    m = &MISSIONS[g->mission];
    if (!m->moving) return;
    g->time += dt;
    for (i = 0; i < g->ntargets; i++) {
        Target *t = &g->targets[i];
        if (!t->alive) continue;
        t->x = t->base_x + sin(g->time * (0.8 + 0.1 * i) + t->phase) * 0.85;
        t->z = t->base_z + cos(g->time * 0.6 + t->phase) * 0.35;
    }
}

/* 返回值: 0 空枪, 1 命中, 2 顺序错误, 3 未命中, 4 任务已结束 */
static int fire(Game *g, double ax, double az, int head) {
    const Mission *m;
    int i, best = -1;
    double best_d = 1e9;
    if (g->mission < 0) return 0;
    m = &MISSIONS[g->mission];
    if (g->hit >= g->total) return 4;
    if (g->mag <= 0) return 0;
    g->mag--;
    g->shots++;
    for (i = 0; i < g->ntargets; i++) {
        Target *t = &g->targets[i];
        double dx, dz, d;
        if (!t->alive) continue;
        dx = ax - t->x;
        dz = az - t->z;
        d = sqrt(dx * dx + dz * dz);
        if (d < best_d) { best_d = d; best = i; }
    }
    if (best < 0 || best_d > 0.40 + WEAPONS[g->wi].spread * 0.15) return 3;
    if (m->head && !head) return 3;
    if (m->order && best != g->seq) return 2;
    g->targets[best].alive = 0;
    g->hit++;
    if (m->order) g->seq++;
    g->score += head ? 30 : 10;
    if (g->hit >= g->total)
        printf("[完成] 任务 %s 完成！得分 %d\n", m->name, g->score);
    return 1;
}

static int reload(Game *g) {
    int need;
    if (g->mission < 0) return 0;
    need = WEAPONS[g->wi].mag - g->mag;
    if (need <= 0 || g->reserve <= 0) return 0;
    if (need > g->reserve) need = g->reserve;
    g->mag += need;
    g->reserve -= need;
    return need;
}

static void select_weapon(Game *g, int idx) {
    if (idx < 0 || idx >= NWEAPONS) {
        printf("没有这把武器（1~%d）\n", NWEAPONS);
        return;
    }
    g->wi = idx;
    g->mag = WEAPONS[idx].mag;
    g->reserve = WEAPONS[idx].reserve;
    printf("已切换：%s（弹匣 %d / 备用 %d）\n",
           WEAPONS[idx].name, g->mag, g->reserve);
}

static void print_status(const Game *g) {
    int i;
    printf("\n--- 状态 ---\n");
    printf("武器：%s  弹匣 %d/%d  备用 %d\n",
           WEAPONS[g->wi].name, g->mag, WEAPONS[g->wi].mag, g->reserve);
    if (g->mission < 0) {
        printf("任务：未开始（输入 m 1~%d）\n", NMISSIONS);
        return;
    }
    printf("任务：%s  命中 %d/%d  得分 %d  开枪 %d  用时 %.1fs\n",
           MISSIONS[g->mission].name, g->hit, g->total,
           g->score, g->shots, g->time);
    for (i = 0; i < g->ntargets; i++) {
        printf("  #%d %c  (%.2f, %.2f)\n", i + 1,
               g->targets[i].alive ? 'O' : 'X',
               g->targets[i].x, g->targets[i].z);
    }
    printf("------------\n");
}

static void print_help(void) {
    int i;
    printf("\nLabStrike 靶场模拟器 —— 命令：\n");
    printf("  m <1~%d>          开始任务\n", NMISSIONS);
    printf("  w <1~%d>          换武器\n", NWEAPONS);
    printf("  f <x> <z> [head]  朝坐标 (x,z) 开枪，可加 head 表示瞄头\n");
    printf("  r                 换弹\n");
    printf("  s                 查看状态\n");
    printf("  t <秒>            推进时间（移动靶会移动）\n");
    printf("  demo              自动演示一遍\n");
    printf("  h                 本帮助\n");
    printf("  q                 退出\n");
    printf("\n任务列表：\n");
    for (i = 0; i < NMISSIONS; i++) {
        printf("  %d. %-15s %d 靶%s%s%s%s\n", i + 1, MISSIONS[i].name, MISSIONS[i].count,
               MISSIONS[i].limit ? " 限时" : "", MISSIONS[i].moving ? " 移动" : "",
               MISSIONS[i].head ? " 爆头" : "", MISSIONS[i].order ? " 顺序" : "");
    }
    printf("\n武器：\n");
    for (i = 0; i < NWEAPONS; i++)
        printf("  %d. %-14s 弹匣 %d / 备用 %d\n", i + 1,
               WEAPONS[i].name, WEAPONS[i].mag, WEAPONS[i].reserve);
}

static void auto_demo(Game *g) {
    int i;
    printf("\n=== 自动演示 ===\n");
    start_mission(g, 0);
    for (i = 0; i < g->ntargets; i++) {
        int r;
        if (g->mag <= 0) printf("换弹：%d 发\n", reload(g));
        r = fire(g, g->targets[i].x, g->targets[i].z, 0);
        printf("第 %d 枪 → %s\n", i + 1,
               r == 1 ? "命中" : r == 2 ? "顺序错" :
               r == 3 ? "未命中" : "空枪/结束");
    }
    print_status(g);
    printf("\n=== 演示结束 ===\n");
}

int main(int argc, char **argv) {
    Game game;
    char line[256];
    init_game(&game);
    if (argc > 1 && strcmp(argv[1], "demo") == 0) {
        auto_demo(&game);
        return 0;
    }
    if (argc > 1 && (strcmp(argv[1], "-h") == 0 || strcmp(argv[1], "--help") == 0)) {
        printf("用法：%s [demo|--help]\n", argv[0]);
        print_help();
        return 0;
    }
    printf("LabStrike 靶场模拟器（C99）— 输入 h 查看命令，q 退出\n");
    while (1) {
        char cmd[32];
        printf("range> ");
        fflush(stdout);
        if (!fgets(line, sizeof(line), stdin)) break;
        if (sscanf(line, "%31s", cmd) != 1) continue;
        if (strcmp(cmd, "q") == 0 || strcmp(cmd, "quit") == 0) break;
        else if (strcmp(cmd, "h") == 0 || strcmp(cmd, "help") == 0) print_help();
        else if (strcmp(cmd, "s") == 0 || strcmp(cmd, "status") == 0) print_status(&game);
        else if (strcmp(cmd, "m") == 0 || strcmp(cmd, "mission") == 0) {
            int n;
            if (sscanf(line, "%*s %d", &n) == 1) start_mission(&game, n - 1);
            else printf("用法：m <1~%d>\n", NMISSIONS);
        }
        else if (strcmp(cmd, "w") == 0 || strcmp(cmd, "weapon") == 0) {
            int n;
            if (sscanf(line, "%*s %d", &n) == 1) select_weapon(&game, n - 1);
            else printf("用法：w <1~%d>\n", NWEAPONS);
        }
        else if (strcmp(cmd, "r") == 0 || strcmp(cmd, "reload") == 0) {
            int n = reload(&game);
            if (n) printf("换弹完成：+%d 发\n", n);
            else printf("无需换弹或备用弹耗尽\n");
        }
        else if (strcmp(cmd, "f") == 0 || strcmp(cmd, "fire") == 0) {
            double x, z;
            char head[16] = "";
            int r;
            if (sscanf(line, "%*s %lf %lf %15s", &x, &z, head) < 2) {
                printf("用法：f <x> <z> [head]\n");
                continue;
            }
            r = fire(&game, x, z, (head[0] == 'h' || head[0] == 'H'));
            printf("%s\n", r == 1 ? "命中！" : r == 2 ? "顺序错误，打错靶了" :
                   r == 3 ? "未命中" : r == 4 ? "任务已结束" : "空枪！先换弹（r）");
        }
        else if (strcmp(cmd, "t") == 0 || strcmp(cmd, "tick") == 0) {
            double dt;
            if (sscanf(line, "%*s %lf", &dt) == 1) {
                update_targets(&game, dt);
                printf("时间 +%.2fs\n", dt);
            } else printf("用法：t <秒>\n");
        }
        else if (strcmp(cmd, "demo") == 0) auto_demo(&game);
        else printf("未知命令：%s（输入 h 查看帮助）\n", cmd);
    }
    printf("已退出。最终得分：%d\n", game.score);
    return 0;
}
