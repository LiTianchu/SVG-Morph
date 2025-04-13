import matplotlib.pyplot as plt
import numpy as np
from matplotlib.legend_handler import HandlerBase

P0 = np.array([0, 0])
P1 = np.array([0.5, 1])
P2 = np.array([1, 0])

def lerp(A, B, t):
    return (1 - t) * A + t * B


fig, ax = plt.subplots(figsize=(8, 8))

ax.plot([P0[0], P1[0], P2[0]], [P0[1], P1[1], P2[1]], 'ro-', label='Control Points')
ax.text(P0[0], P0[1], 'P0', verticalalignment='bottom', horizontalalignment='right')
ax.text(P1[0], P1[1], 'P1', verticalalignment='bottom', horizontalalignment='right')
ax.text(P2[0], P2[1], 'P2', verticalalignment='bottom', horizontalalignment='left')

ax.plot([P0[0], P1[0]], [P0[1], P1[1]], 'b--', alpha=0.3)
ax.plot([P1[0], P2[0]], [P1[1], P2[1]], 'b--', alpha=0.3)

for t in np.linspace(0, 1.0, 50):
    Q0 = lerp(P0, P1, t)  
    Q1 = lerp(P1, P2, t)  
    B = lerp(Q0, Q1, t)   

    ax.plot([Q0[0], Q1[0]], [Q0[1], Q1[1]], 'bo-', alpha=0.5, label='Intermediate Points', markersize=4)
    ax.plot(B[0], B[1], 'go', label="Point on Curve (B)", markersize=4)

    ax.plot([Q0[0], Q1[0]], [Q0[1], Q1[1]], 'g--', alpha=0.6)


class MarkerHandler(HandlerBase):
    def create_artists(self, legend, tup,xdescent, ydescent,
                        width, height, fontsize,trans):
        return [plt.Line2D([width/2], [height/2.],linestyle='',
                       marker=tup[1],color=tup[0], transform=trans)]
    
list_color  = ["red", "blue", "green"]
list_mak    = ["o","o","o"]
list_lab    = ['Control Points', 'Intermediate Points', 'Curve Point (B)']

ax.legend(list(zip(list_color,list_mak)), list_lab, 
          handler_map={tuple:MarkerHandler()}) 

ax.set_title("Complete 3-point Bézier Curve Drawn with De Casteljau's Algorithm")

ax.set_xlabel("t")
ax.set_ylabel("B(t)")
ax.set_aspect('equal')
plt.grid(True)
plt.savefig('de_casteljau.png')
plt.show()

